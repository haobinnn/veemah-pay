-- Seed base roles and permissions
INSERT INTO roles (name, description)
VALUES
    ('ADMIN', 'Administrative user with full management capabilities'),
    ('CUSTOMER', 'Customer user with account and transaction capabilities')
ON CONFLICT (name) DO NOTHING;

-- ADMIN permissions
INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p.permission
FROM roles r
JOIN (VALUES
    ('USER_CREATE'),
    ('USER_LIST'),
    ('USER_UPDATE'),
    ('USER_DELETE'),
    ('ROLE_MANAGE'),
    ('ACCOUNT_MANAGE'),
    ('TRANSACTION_MANAGE')
) AS p(permission) ON TRUE
WHERE r.name = 'ADMIN'
ON CONFLICT DO NOTHING;

-- CUSTOMER permissions
INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p.permission
FROM roles r
JOIN (VALUES
    ('SELF_VIEW'),
    ('SELF_UPDATE'),
    ('TX_CREATE'),
    ('TX_LIST')
) AS p(permission) ON TRUE
WHERE r.name = 'CUSTOMER'
ON CONFLICT DO NOTHING;