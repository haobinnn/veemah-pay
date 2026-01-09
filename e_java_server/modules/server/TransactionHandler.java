package modules.server;

import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import modules.database.DatabaseManager;
import java.io.IOException;
import java.io.OutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;
import java.math.BigDecimal;
import java.net.URLDecoder;

public class TransactionHandler implements HttpHandler {
    
    @Override
    public void handle(HttpExchange exchange) throws IOException {
        // Set CORS headers
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, ngrok-skip-browser-warning, Accept");
        exchange.getResponseHeaders().set("Access-Control-Max-Age", "3600");
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        
        // Handle preflight OPTIONS request
        if ("OPTIONS".equals(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(200, 0);
            exchange.getResponseBody().close();
            return;
        }
        
        try {
            String method = exchange.getRequestMethod();
            String path = exchange.getRequestURI().getPath();
            
            // Log incoming request
            System.out.println(">> " + method + " " + path + " from " + exchange.getRemoteAddress());
            
            switch (method) {
                case "GET":
                    handleGet(exchange);
                    break;
                case "POST":
                    handlePost(exchange);
                    break;
                case "PUT":
                    handlePut(exchange, path);
                    break;
                case "DELETE":
                    handleDelete(exchange, path);
                    break;
                default:
                    sendErrorResponse(exchange, 405, "Method not allowed: " + method);
            }
            
        } catch (Exception e) {
            System.err.println("Error handling request: " + e.getMessage());
            e.printStackTrace();
            sendErrorResponse(exchange, 500, "Internal server error: " + e.getMessage());
        }
    }
    
    // GET /api/transactions - Get all transactions for user with query params
    private void handleGet(HttpExchange exchange) throws IOException, SQLException {
        Map<String, String> queryParams = parseQueryString(exchange.getRequestURI().getQuery());
        
        // Check if requesting specific transaction by ID
        String pathInfo = exchange.getRequestURI().getPath();
        String[] pathParts = pathInfo.split("/");
        
        if (pathParts.length == 4 && !pathParts[3].isEmpty()) {
            // Get specific transaction by ID
            getTransactionById(exchange, pathParts[3]);
            return;
        }
        
        // Get transactions with filters
        String account = queryParams.get("account");
        if (account == null || account.isEmpty()) {
            sendErrorResponse(exchange, 400, "account parameter is required");
            return;
        }
        
        getAllTransactions(exchange, account, queryParams);
    }
    
    private void getAllTransactions(HttpExchange exchange, String accountNumber, Map<String, String> params) throws IOException, SQLException {
        // Introspect available columns like Next.js does
        String colQuery = "SELECT column_name FROM information_schema.columns " +
                         "WHERE table_schema = 'public' AND table_name = 'transactions'";
        
        Set<String> availableColumns = new HashSet<>();
        try (PreparedStatement stmt = DatabaseManager.getConnection().prepareStatement(colQuery)) {
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                availableColumns.add(rs.getString("column_name"));
            }
        }
        
        if (availableColumns.isEmpty()) {
            Map<String, Object> response = new HashMap<>();
            response.put("transactions", new ArrayList<>());
            sendJsonResponse(exchange, 200, response);
            return;
        }
        
        // Build dynamic SELECT fields based on available columns
        List<String> selectFields = buildSelectFields(availableColumns);
        
        // Build WHERE conditions
        StringBuilder whereClause = new StringBuilder();
        List<Object> queryParams = new ArrayList<>();
        int paramIndex = 1;
        
        // Account filter (source or target)
        if (availableColumns.contains("target_account")) {
            whereClause.append("(account_number = ? OR target_account = ?)");
            queryParams.add(accountNumber);
            queryParams.add(accountNumber);
            paramIndex += 2;
        } else {
            whereClause.append("account_number = ?");
            queryParams.add(accountNumber);
            paramIndex++;
        }
        
        // Add optional filters
        if (params.containsKey("type") && !params.get("type").isEmpty() && availableColumns.contains("type")) {
            whereClause.append(" AND type = ?");
            queryParams.add(params.get("type"));
            paramIndex++;
        }
        
        if (params.containsKey("status") && !params.get("status").isEmpty() && availableColumns.contains("status")) {
            whereClause.append(" AND status = ?");
            queryParams.add(params.get("status"));
            paramIndex++;
        }
        
        // Date filters
        if (params.containsKey("from") && availableColumns.contains("created_at")) {
            whereClause.append(" AND created_at >= ?");
            queryParams.add(Timestamp.valueOf(params.get("from") + " 00:00:00"));
            paramIndex++;
        }
        
        if (params.containsKey("to") && availableColumns.contains("created_at")) {
            whereClause.append(" AND created_at <= ?");
            queryParams.add(Timestamp.valueOf(params.get("to") + " 23:59:59"));
            paramIndex++;
        }
        
        // Amount filters
        if (params.containsKey("min_amount") && availableColumns.contains("amount")) {
            whereClause.append(" AND amount >= ?");
            queryParams.add(new BigDecimal(params.get("min_amount")));
            paramIndex++;
        }
        
        if (params.containsKey("max_amount") && availableColumns.contains("amount")) {
            whereClause.append(" AND amount <= ?");
            queryParams.add(new BigDecimal(params.get("max_amount")));
            paramIndex++;
        }
        
        // Build ORDER BY and LIMIT
        String orderBy = availableColumns.contains("created_at") ? 
            "ORDER BY created_at DESC, id DESC" : "ORDER BY id DESC";
        
        int limit = 100; // Default limit
        if (params.containsKey("limit")) {
            try {
                limit = Math.min(Integer.parseInt(params.get("limit")), 500);
            } catch (NumberFormatException e) {
                // Use default
            }
        }
        
        // Execute query
        String sql = "SELECT " + String.join(", ", selectFields) + 
                    " FROM transactions WHERE " + whereClause + 
                    " " + orderBy + " LIMIT " + limit;
        
        try (PreparedStatement stmt = DatabaseManager.getConnection().prepareStatement(sql)) {
            for (int i = 0; i < queryParams.size(); i++) {
                stmt.setObject(i + 1, queryParams.get(i));
            }
            
            ResultSet rs = stmt.executeQuery();
            List<Map<String, Object>> transactions = new ArrayList<>();
            
            while (rs.next()) {
                Map<String, Object> transaction = new HashMap<>();
                
                // Map all selected fields
                for (String field : selectFields) {
                    String cleanField = field.contains(" AS ") ? 
                        field.substring(field.lastIndexOf(" AS ") + 4) : field;
                    
                    if (cleanField.endsWith("::float")) {
                        cleanField = cleanField.replace("::float", "");
                    }
                    
                    Object value = rs.getObject(cleanField);
                    transaction.put(cleanField, value);
                }
                
                transactions.add(transaction);
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("transactions", transactions);
            response.put("next_cursor", null); // Simplified for now
            
            sendJsonResponse(exchange, 200, response);
        }
    }
    
    private void getTransactionById(HttpExchange exchange, String id) throws IOException, SQLException {
        String sql = "SELECT * FROM transactions WHERE id = ?";
        
        try (PreparedStatement stmt = DatabaseManager.getConnection().prepareStatement(sql)) {
            stmt.setInt(1, Integer.parseInt(id));
            ResultSet rs = stmt.executeQuery();
            
            if (rs.next()) {
                Map<String, Object> transaction = resultSetToMap(rs);
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("data", transaction);
                
                sendJsonResponse(exchange, 200, response);
            } else {
                sendErrorResponse(exchange, 404, "Transaction not found");
            }
        }
    }
    
    // POST /api/transactions - Create new transaction
    private void handlePost(HttpExchange exchange) throws IOException, SQLException {
        String requestBody = readRequestBody(exchange);
        Map<String, Object> data = parseJson(requestBody);
        
        // Validate required fields
        String[] requiredFields = {"source_account", "amount", "type"};
        for (String field : requiredFields) {
            if (!data.containsKey(field) || data.get(field) == null) {
                sendErrorResponse(exchange, 400, "Missing required field: " + field);
                return;
            }
        }
        
        String type = (String) data.get("type");
        if (type.equals("transfer") && !data.containsKey("target_account")) {
            sendErrorResponse(exchange, 400, "target_account is required for transfers");
            return;
        }
        
        // Get available columns for dynamic insert
        String colQuery = "SELECT column_name FROM information_schema.columns " +
                         "WHERE table_schema = 'public' AND table_name = 'transactions'";
        
        Set<String> availableColumns = new HashSet<>();
        try (PreparedStatement stmt = DatabaseManager.getConnection().prepareStatement(colQuery)) {
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                availableColumns.add(rs.getString("column_name"));
            }
        }
        
        // Build dynamic INSERT
        List<String> insertCols = new ArrayList<>();
        List<String> valuesSql = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        
        // Required fields
        if (availableColumns.contains("account_number")) {
            insertCols.add("account_number");
            valuesSql.add("?");
            params.add(data.get("source_account"));
        }
        
        if (availableColumns.contains("amount")) {
            insertCols.add("amount");
            valuesSql.add("?");
            params.add(new BigDecimal(data.get("amount").toString()));
        }
        
        if (availableColumns.contains("type")) {
            insertCols.add("type");
            valuesSql.add("?");
            params.add(data.get("type"));
        }
        
        // Optional fields
        if (data.containsKey("target_account") && availableColumns.contains("target_account")) {
            insertCols.add("target_account");
            valuesSql.add("?");
            params.add(data.get("target_account"));
        }
        
        if (data.containsKey("note") && availableColumns.contains("note")) {
            insertCols.add("note");
            valuesSql.add("?");
            params.add(data.get("note"));
        }
        
        if (availableColumns.contains("status")) {
            insertCols.add("status");
            valuesSql.add("?");
            params.add(data.getOrDefault("status", "Completed"));
        }
        
        if (availableColumns.contains("created_by")) {
            insertCols.add("created_by");
            valuesSql.add("?");
            params.add(data.getOrDefault("created_by", data.get("source_account")));
        }
        
        String sql = "INSERT INTO transactions (" + String.join(", ", insertCols) + 
                    ") VALUES (" + String.join(", ", valuesSql) + ") RETURNING *";
        
        try (PreparedStatement stmt = DatabaseManager.getConnection().prepareStatement(sql)) {
            for (int i = 0; i < params.size(); i++) {
                stmt.setObject(i + 1, params.get(i));
            }
            
            ResultSet rs = stmt.executeQuery();
            
            if (rs.next()) {
                Map<String, Object> transaction = resultSetToMap(rs);
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("transaction", transaction);
                response.put("message", "Transaction created successfully");
                
                sendJsonResponse(exchange, 201, response);
            }
        }
    }
    
    // PUT /api/transactions/{id} - Update transaction
    private void handlePut(HttpExchange exchange, String path) throws IOException, SQLException {
        String[] pathParts = path.split("/");
        if (pathParts.length != 4) {
            sendErrorResponse(exchange, 400, "Invalid path for update: " + path);
            return;
        }
        
        String transactionId = pathParts[3];
        String requestBody = readRequestBody(exchange);
        Map<String, Object> data = parseJson(requestBody);
        
        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        
        // Build dynamic update
        if (data.containsKey("status")) {
            setClauses.add("status = ?");
            params.add(data.get("status"));
        }
        if (data.containsKey("note")) {
            setClauses.add("note = ?");
            params.add(data.get("note"));
        }
        
        if (setClauses.isEmpty()) {
            sendErrorResponse(exchange, 400, "No valid fields to update");
            return;
        }
        
        params.add(Integer.parseInt(transactionId));
        
        String sql = "UPDATE transactions SET " + String.join(", ", setClauses) + 
                    " WHERE id = ? RETURNING *";
        
        try (PreparedStatement stmt = DatabaseManager.getConnection().prepareStatement(sql)) {
            for (int i = 0; i < params.size(); i++) {
                stmt.setObject(i + 1, params.get(i));
            }
            
            ResultSet rs = stmt.executeQuery();
            
            if (rs.next()) {
                Map<String, Object> transaction = resultSetToMap(rs);
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("transaction", transaction);
                response.put("message", "Transaction updated successfully");
                
                sendJsonResponse(exchange, 200, response);
            } else {
                sendErrorResponse(exchange, 404, "Transaction not found");
            }
        }
    }
    
    // DELETE /api/transactions/{id} - Soft delete transaction
    private void handleDelete(HttpExchange exchange, String path) throws IOException, SQLException {
        String[] pathParts = path.split("/");
        if (pathParts.length != 4) {
            sendErrorResponse(exchange, 400, "Invalid path for delete: " + path);
            return;
        }
        
        String transactionId = pathParts[3];
        
        // Soft delete by setting status to 'Cancelled'
        String sql = "UPDATE transactions SET status = 'Cancelled' WHERE id = ?";
        
        try (PreparedStatement stmt = DatabaseManager.getConnection().prepareStatement(sql)) {
            stmt.setInt(1, Integer.parseInt(transactionId));
            int rowsAffected = stmt.executeUpdate();
            
            if (rowsAffected > 0) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("message", "Transaction cancelled successfully");
                
                sendJsonResponse(exchange, 200, response);
            } else {
                sendErrorResponse(exchange, 404, "Transaction not found");
            }
        }
    }
    
    // Utility methods
    private List<String> buildSelectFields(Set<String> availableColumns) {
        List<String> fields = new ArrayList<>();
        
        fields.add("id");
        fields.add(availableColumns.contains("type") ? "type" : "('unknown')::text AS type");
        fields.add(availableColumns.contains("status") ? "status" : "('Completed')::text AS status");
        fields.add("account_number");
        fields.add(availableColumns.contains("target_account") ? "target_account" : "NULL::text AS target_account");
        fields.add("amount::float AS amount");
        fields.add(availableColumns.contains("fee") ? "fee::float AS fee" : "0::float AS fee");
        fields.add(availableColumns.contains("note") ? "note" : "NULL AS note");
        fields.add(availableColumns.contains("created_by") ? "created_by" : "('-')::text AS created_by");
        fields.add(availableColumns.contains("created_at") ? "created_at" : "now() AS created_at");
        fields.add(availableColumns.contains("completed_at") ? "completed_at" : "NULL AS completed_at");
        fields.add(availableColumns.contains("voided_at") ? "voided_at" : "NULL AS voided_at");
        
        return fields;
    }
    
    private String readRequestBody(HttpExchange exchange) throws IOException {
        InputStream inputStream = exchange.getRequestBody();
        return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
    }
    
    private Map<String, String> parseQueryString(String query) {
        Map<String, String> result = new HashMap<>();
        if (query != null && !query.isEmpty()) {
            String[] pairs = query.split("&");
            for (String pair : pairs) {
                String[] keyValue = pair.split("=", 2);
                if (keyValue.length == 2) {
                    try {
                        result.put(
                            URLDecoder.decode(keyValue[0], StandardCharsets.UTF_8),
                            URLDecoder.decode(keyValue[1], StandardCharsets.UTF_8)
                        );
                    } catch (Exception e) {
                        // Skip malformed pairs
                    }
                }
            }
        }
        return result;
    }
    
    private Map<String, Object> parseJson(String json) {
        // Simple JSON parser for basic objects
        Map<String, Object> result = new HashMap<>();
        
        if (json == null || json.trim().isEmpty()) {
            return result;
        }
        
        // Remove outer braces and split by commas (simple approach)
        json = json.trim().replaceAll("^\\{|\\}$", "");
        
        // Split by commas, but respect quoted strings
        String[] pairs = json.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
        
        for (String pair : pairs) {
            String[] keyValue = pair.split(":", 2);
            if (keyValue.length == 2) {
                String key = keyValue[0].trim().replaceAll("^\"|\"$", "");
                String value = keyValue[1].trim();
                
                // Parse different value types
                if (value.equals("null")) {
                    result.put(key, null);
                } else if (value.equals("true")) {
                    result.put(key, true);
                } else if (value.equals("false")) {
                    result.put(key, false);
                } else if (value.startsWith("\"") && value.endsWith("\"")) {
                    result.put(key, value.substring(1, value.length() - 1));
                } else {
                    // Try to parse as number
                    try {
                        if (value.contains(".")) {
                            result.put(key, Double.parseDouble(value));
                        } else {
                            result.put(key, Long.parseLong(value));
                        }
                    } catch (NumberFormatException e) {
                        result.put(key, value);
                    }
                }
            }
        }
        
        return result;
    }
    
    private Map<String, Object> resultSetToMap(ResultSet rs) throws SQLException {
        Map<String, Object> result = new HashMap<>();
        ResultSetMetaData metaData = rs.getMetaData();
        int columnCount = metaData.getColumnCount();
        
        for (int i = 1; i <= columnCount; i++) {
            String columnName = metaData.getColumnName(i);
            Object value = rs.getObject(i);
            result.put(columnName, value);
        }
        
        return result;
    }
    
    private void sendJsonResponse(HttpExchange exchange, int statusCode, Object data) throws IOException {
        String json = objectToJson(data);
        byte[] responseBytes = json.getBytes(StandardCharsets.UTF_8);
        
        exchange.sendResponseHeaders(statusCode, responseBytes.length);
        OutputStream os = exchange.getResponseBody();
        os.write(responseBytes);
        os.close();
    }
    
    private void sendErrorResponse(HttpExchange exchange, int statusCode, String message) throws IOException {
        Map<String, Object> error = new HashMap<>();
        error.put("success", false);
        error.put("error", message);
        error.put("timestamp", new java.util.Date());
        
        sendJsonResponse(exchange, statusCode, error);
    }
    
    private String objectToJson(Object obj) {
        if (obj instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) obj;
            StringBuilder json = new StringBuilder("{");
            boolean first = true;
            
            for (Map.Entry<String, Object> entry : map.entrySet()) {
                if (!first) json.append(",");
                json.append("\"").append(escapeJson(entry.getKey())).append("\":");
                json.append(valueToJson(entry.getValue()));
                first = false;
            }
            
            json.append("}");
            return json.toString();
        }
        
        return "{}";
    }
    
    private String valueToJson(Object value) {
        if (value == null) {
            return "null";
        } else if (value instanceof String) {
            return "\"" + escapeJson((String) value) + "\"";
        } else if (value instanceof Number || value instanceof Boolean) {
            return value.toString();
        } else if (value instanceof java.util.Date) {
            return "\"" + value.toString() + "\"";
        } else if (value instanceof Timestamp) {
            return "\"" + value.toString() + "\"";
        } else if (value instanceof List) {
            @SuppressWarnings("unchecked")
            List<Object> list = (List<Object>) value;
            StringBuilder json = new StringBuilder("[");
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) json.append(",");
                json.append(valueToJson(list.get(i)));
            }
            json.append("]");
            return json.toString();
        } else if (value instanceof Map) {
            return objectToJson(value);
        } else {
            return "\"" + escapeJson(value.toString()) + "\"";
        }
    }
    
    private String escapeJson(String str) {
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t");
    }
}