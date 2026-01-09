-- Notifications / Inbox
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('MESSAGE','ALERT')),
    title TEXT NOT NULL,
    body TEXT,
    status TEXT NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD','READ')),
    recipient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_account_number TEXT REFERENCES accounts(account_number),
    sender_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);