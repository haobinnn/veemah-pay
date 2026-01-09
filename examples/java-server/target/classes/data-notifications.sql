-- Optional seed example (safe no-op if users absent)
-- Will only insert if a user with id=1 exists
INSERT INTO notifications (type, title, body, status, recipient_user_id)
SELECT 'ALERT', 'Welcome', 'Your inbox is ready', 'UNREAD', u.id
FROM users u
WHERE u.id = 1
ON CONFLICT DO NOTHING;