import javax.swing.*;

public class main {
    private static String[][] ACCOUNT_TABLE = {
            {"12345", "Roel Richard", "5000.00", "1111", "Active"},
            {"23456", "Dorie Marie", "0.00", "2222", "Active"},
            {"34567", "Railee Darrel", "10000", "3333", "Active"},
            {"45678", "Railynne Dessirei", "2500", "4444", "Active"},
            {"56789", "Raine Dessirei", "10000", "5555", "Locked"},
            {"0000", "Administrator", "0.00", "0000", "Active"} // Administrator account
    };

    private static final String ADMIN_ACCOUNT_NUMBER = "0000";
    private static final String ADMIN_PIN_NUMBER = "0000";
    private static final int MAX_LOGIN_ATTEMPTS = 3;

    public static void main(String[] args) {
        showMainMenu();
    }

    private static void showMainMenu() {
        String choice = JOptionPane.showInputDialog(null, "Veemah Pay\nS -> Start Transaction\nQ -> Quit\nEnter your choice:");

        if (choice == null) {
            System.exit(0);
        }

        switch (choice.toUpperCase()) {
            case "S":
                showLoginMenu();
                break;
            case "Q":
                System.exit(0);
                break;
            default:
                showMainMenu();
                break;
        }
    }

    private static void showLoginMenu() {
        JTextField field1 = new JTextField();
        JTextField field2 = new JTextField();

        Object[] fields = {
                "Veemah Pay\n\nEnter account number:", field1,
                "Enter pin number:", field2
        };

        int result = JOptionPane.showConfirmDialog(null, fields, "", JOptionPane.DEFAULT_OPTION);

        if (result == JOptionPane.OK_OPTION) {
            String accountNumber = field1.getText();
            String pinNumber = new String(field2.getText());

            if (validateLogin(accountNumber, pinNumber)) {
                showTransactionMenu(accountNumber);
            } else {
                showMainMenu();
            }
        } else {
            showMainMenu();
        }
    }


    private static boolean validateLogin(String accountNumber, String pinNumber) {
        int loginAttempts = 0;
        boolean isValidLogin = false;

        while (loginAttempts < MAX_LOGIN_ATTEMPTS) {
            for (String[] account : ACCOUNT_TABLE) {
                if (accountNumber.equals(account[0])) {
                    if (account[4].equals("Locked")) {
                        JOptionPane.showMessageDialog(null, "Account locked. Please contact customer support.");
                        return false;
                    }
                    if (pinNumber.equals(account[3])) {
                        isValidLogin = true;
                        break;
                    } else {
                        loginAttempts++;
                        JOptionPane.showMessageDialog(null, "Invalid pin number. Attempts remaining: " + (MAX_LOGIN_ATTEMPTS - loginAttempts));
                        if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
                            account[4] = "Locked";
                            JOptionPane.showMessageDialog(null, "Account locked due to multiple login attempts. Please contact customer support.");
                        }
                    }
                }
            }

            if (isValidLogin) {
                break;
            }

            JTextField field1 = new JTextField();
            JTextField field2 = new JTextField();

            Object[] fields = {
                    "Veemah Pay\n\nEnter account number:", field1,
                    "Enter pin number:", field2
            };

            int result = JOptionPane.showConfirmDialog(null, fields, "", JOptionPane.DEFAULT_OPTION);

            if (result != JOptionPane.OK_OPTION) {
                return false;
            }

            accountNumber = field1.getText();
            pinNumber = new String(field2.getText());
        }

        return isValidLogin;
    }

    private static void showTransactionMenu(String accountNumber) {
        String accountType = getAccountType(accountNumber);

        if (accountType.equals("Admin")) {
            String option = JOptionPane.showInputDialog(null,
                    "ADMIN MENU\n\n" +
                            "(V) View Customer Information\n" +
                            "(A) Add New Customer\n" +
                            "(E) Edit Customer Information\n" +
                            "(C) Change Customer Pin Number\n" +
                            "(X) Exit\n" +
                            "Enter your option:");

            switch (option.toUpperCase()) {
                case "V":
                    viewCustomerInformation();
                    break;
                case "A":
                    addNewCustomer();
                    break;
                case "E":
                    editCustomerInformation();
                    break;
                case "C":
                    changeCustomerPinNumber();
                    break;
                case "X":
                    showMainMenu();
                    break;
                default:
                    showTransactionMenu(accountNumber);
                    break;
            }
        } else {
            String option = JOptionPane.showInputDialog(null,
                    "SELECT TYPE OF TRANSACTION\n\n" +
                            "B -> Balance Inquiry\n" +
                            "W -> Withdrawal\n" +
                            "D -> Deposit\n" +
                            "T -> Fund Transfer\n" +
                            "C -> Cancel\n" +
                            "Enter transaction type:");

            switch (option.toUpperCase()) {
                case "B":
                    showBalanceInquiry(accountNumber);
                    break;
                case "W":
                    showWithdrawal(accountNumber);
                    break;
                case "D":
                    showDeposit(accountNumber);
                    break;
                case "T":
                    showFundTransfer(accountNumber);
                    break;
                case "C":
                    showMainMenu();
                    break;
                default:
                    showTransactionMenu(accountNumber);
                    break;
            }
        }
    }

    private static String getAccountType(String accountNumber) {
        if (accountNumber.equals(ADMIN_ACCOUNT_NUMBER)) {
            return "Admin";
        } else {
            return "Customer";
        }
    }

    private static void viewCustomerInformation() {
        String accountNumber = JOptionPane.showInputDialog(null, "VIEW CUSTOMER INFORMATION\nEnter account number:");

        // If the user closes the dialog or clicks OK without entering an account number, showTransactionMenu is called
        if (accountNumber == null || accountNumber.isEmpty()) {
            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
            return;
        }

        String[] account = findAccount(accountNumber);

        if (account != null) {
            String accountName = account[1];
            double balance = Double.parseDouble(account[2]);
            String accountStatus = account[4];

            JOptionPane.showMessageDialog(null, "Account #: " + accountNumber +
                    "\nAccount Name: " + accountName +
                    "\nBalance: " + balance +
                    "\nAccount Status: " + accountStatus);

            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
        } else {
            JOptionPane.showMessageDialog(null, "Invalid account number.");
            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
        }
    }

    private static void addNewCustomer() {
        JTextField accountNumberField = new JTextField();
        JTextField accountNameField = new JTextField();
        JTextField balanceField = new JTextField();
        JTextField pinNumberField = new JTextField();
        JTextField statusField = new JTextField();

        Object[] fields = {
                "Account Number (5 digits):", accountNumberField,
                "Account Name:", accountNameField,
                "Balance:", balanceField,
                "PIN Number (4 digits):", pinNumberField,
                "Account Status (Locked/Active):", statusField
        };

        int result = JOptionPane.showConfirmDialog(null, fields, "Add New Customer", JOptionPane.OK_CANCEL_OPTION);

        if (result == JOptionPane.OK_OPTION) {
            String accountNumber = accountNumberField.getText();
            String accountName = accountNameField.getText();
            String balance = balanceField.getText();
            String pinNumber = new String(pinNumberField.getText());
            String status = statusField.getText();

            // Check if any required fields are empty
            if (accountNumber.isEmpty() || accountName.isEmpty() || balance.isEmpty() || pinNumber.isEmpty() || status.isEmpty()) {
                JOptionPane.showMessageDialog(null, "Please fill in all the required fields.");
                addNewCustomer(); // Prompt to input again
                return;
            }

            // Validate account number length
            if (accountNumber.length() != 5) {
                JOptionPane.showMessageDialog(null, "Account number must have exactly 5 digits.");
                addNewCustomer(); // Prompt to input again
                return;
            }

            // Validate pin number length
            if (pinNumber.length() != 4) {
                JOptionPane.showMessageDialog(null, "PIN number must have exactly 4 digits.");
                addNewCustomer(); // Prompt to input again
                return;
            }

            // Validate account status
            if (!status.equalsIgnoreCase("Locked") && !status.equalsIgnoreCase("Active")) {
                JOptionPane.showMessageDialog(null, "Account status can only be 'Locked' or 'Active'.");
                addNewCustomer(); // Prompt to input again
                return;
            }

            // Check if account number already exists
            if (isAccountNumberExists(accountNumber)) {
                JOptionPane.showMessageDialog(null, "An account with the provided account number already exists.");
                addNewCustomer(); // Prompt to input again
                return;
            }

            int newLength = ACCOUNT_TABLE.length + 1;
            String[][] updatedTable = new String[newLength][];
            System.arraycopy(ACCOUNT_TABLE, 0, updatedTable, 0, ACCOUNT_TABLE.length);
            updatedTable[newLength - 1] = new String[]{accountNumber, accountName, balance, pinNumber, status};
            ACCOUNT_TABLE = updatedTable;

            JOptionPane.showMessageDialog(null, "New customer added successfully!");
            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
        } else {
            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
        }
    }

    private static boolean isAccountNumberExists(String accountNumber) {
        for (String[] account : ACCOUNT_TABLE) {
            if (account[0].equals(accountNumber)) {
                return true;
            }
        }
        return false;
    }


    private static void editCustomerInformation() {
        String accountNumber = JOptionPane.showInputDialog(null, "EDIT CUSTOMER INFORMATION\nEnter account number:");

        // If the user closes the dialog or clicks OK without entering an account number, showTransactionMenu is called
        if (accountNumber == null || accountNumber.isEmpty()) {
            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
            return;
        }

        if (accountNumber.equals(ADMIN_ACCOUNT_NUMBER)) {
            JOptionPane.showMessageDialog(null, "Cannot edit the information of the administrator account.");
            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
            return;
        }

        String[] account = findAccount(accountNumber);

        if (account != null) {
            String accountName = JOptionPane.showInputDialog(null, "Enter new account name:");
            String accountStatus = JOptionPane.showInputDialog(null, "Enter new account status (Locked/Active):");

            // Check if any required fields are empty
            if (accountName.isEmpty() || accountStatus.isEmpty()) {
                JOptionPane.showMessageDialog(null, "Please fill in all the required fields.");
                editCustomerInformation(); // Prompt to input again
                return;
            }

            // Validate account status
            if (!accountStatus.equalsIgnoreCase("Locked") && !accountStatus.equalsIgnoreCase("Active")) {
                JOptionPane.showMessageDialog(null, "Account status can only be 'Locked' or 'Active'.");
                editCustomerInformation(); // Prompt to input again
                return;
            }

            account[1] = accountName;
            account[4] = accountStatus;

            JOptionPane.showMessageDialog(null, "Customer information updated successfully!");
            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
        } else {
            JOptionPane.showMessageDialog(null, "Invalid account number.");
            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
        }
    }

    private static void changeCustomerPinNumber() {
        String accountNumber = JOptionPane.showInputDialog(null, "CHANGE CUSTOMER PIN NUMBER\nEnter account number:");

        // If the user closes the dialog or clicks OK without entering an account number, showTransactionMenu is called
        if (accountNumber == null || accountNumber.isEmpty()) {
            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
            return;
        }

        if (accountNumber.equals(ADMIN_ACCOUNT_NUMBER)) {
            JOptionPane.showMessageDialog(null, "Cannot change the PIN number of the administrator account.");
            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
            return;
        }

        String[] account = findAccount(accountNumber);

        if (account != null) {
            String newPinNumber = JOptionPane.showInputDialog(null, "Enter new PIN number:");

            // Check if the new PIN number is empty or invalid
            if (newPinNumber.isEmpty() || !isValidPin(newPinNumber)) {
                JOptionPane.showMessageDialog(null, "Invalid PIN number. Please enter a 4-digit numeric PIN.");
                changeCustomerPinNumber(); // Prompt to input again
                return;
            }

            account[3] = newPinNumber;

            JOptionPane.showMessageDialog(null, "PIN number updated successfully!");
            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
        } else {
            JOptionPane.showMessageDialog(null, "Invalid account number.");
            showTransactionMenu(ADMIN_ACCOUNT_NUMBER); // Redirect to the administrator menu
        }
    }

    private static boolean isValidPin(String pinNumber) {
        // Regular expression to validate a 4-digit numeric PIN
        String pinRegex = "^[0-9]{4}$";
        return pinNumber.matches(pinRegex);
    }

    private static void showBalanceInquiry(String accountNumber) {
        String[] account = findAccount(accountNumber);

        if (account != null) {
            String accountName = account[1];
            double balance = Double.parseDouble(account[2]);
            JOptionPane.showMessageDialog(null, "Account #: " + accountNumber + "\nAccount Name: " + accountName + "\nBalance: " + balance);
            showTransactionMenu(accountNumber);
        } else {
            JOptionPane.showMessageDialog(null, "Invalid account number.");
            showTransactionMenu(accountNumber);
        }
    }

    private static void showWithdrawal(String accountNumber) {
        String[] account = findAccount(accountNumber);

        if (account != null) {
            double balance = Double.parseDouble(account[2]);
            double amount = promptAmount("Enter amount to be withdrawn:");
            if (amount >= 100 && amount <= balance) {
                balance -= amount;
                account[2] = String.format("%.2f", balance);
                JOptionPane.showMessageDialog(null, "Withdrawn amount: " + amount);
                showTransactionMenu(accountNumber);
            } else {
                JOptionPane.showMessageDialog(null, "Invalid amount or insufficient funds.");
                showWithdrawal(accountNumber);
            }
        } else {
            JOptionPane.showMessageDialog(null, "Invalid account number.");
            showTransactionMenu(accountNumber);
        }
    }

    private static void showDeposit(String accountNumber) {
        String[] account = findAccount(accountNumber);

        if (account != null) {
            double amount = promptAmount("Enter amount to be deposited:");

            if (amount >= 100) {
                double balance = Double.parseDouble(account[2]);
                balance += amount;
                account[2] = String.format("%.2f", balance);
                JOptionPane.showMessageDialog(null, "Deposited amount: " + amount);
                showTransactionMenu(accountNumber);
            } else {
                JOptionPane.showMessageDialog(null, "Invalid amount.");
                showDeposit(accountNumber);
            }
        } else {
            JOptionPane.showMessageDialog(null, "Invalid account number.");
            showTransactionMenu(accountNumber);
        }
    }

    private static void showFundTransfer(String accountNumber) {
        String[] sourceAccount = findAccount(accountNumber);

        if (sourceAccount != null) {
            double sourceBalance = Double.parseDouble(sourceAccount[2]);
            double amount = promptAmount("Enter amount to be transferred:");
            String targetAccountNumber = JOptionPane.showInputDialog(null, "Enter target account number:");
            String[] targetAccount = findAccount(targetAccountNumber);

            if (targetAccount != null && amount >= 1000) {
                double targetBalance = Double.parseDouble(targetAccount[2]);
                double serviceFee = 25.00;
                if (amount + serviceFee <= sourceBalance) {
                    sourceBalance -= amount + serviceFee;
                    targetBalance += amount;
                    sourceAccount[2] = String.format("%.2f", sourceBalance);
                    targetAccount[2] = String.format("%.2f", targetBalance);
                    JOptionPane.showMessageDialog(null, "Fund Transfer Successful!");
                    showTransactionMenu(accountNumber);
                } else {
                    JOptionPane.showMessageDialog(null, "Insufficient funds.");
                    showTransactionMenu(accountNumber);
                }
            } else {
                JOptionPane.showMessageDialog(null, "Invalid target account number or amount.");
                showFundTransfer(accountNumber);
            }
        } else {
            JOptionPane.showMessageDialog(null, "Invalid account number.");
            showTransactionMenu(accountNumber);
        }
    }

    private static double promptAmount(String message) {
        String input = JOptionPane.showInputDialog(null, message);
        try {
            return Double.parseDouble(input);
        } catch (NumberFormatException e) {
            JOptionPane.showMessageDialog(null, "Invalid input. Please enter a valid amount.");
            return promptAmount(message);
        }
    }

    private static String[] findAccount(String accountNumber) {
        for (String[] account : ACCOUNT_TABLE) {
            if (accountNumber.equals(account[0])) {
                return account;
            }
        }
        return null;
    }
}