-- Seed data copied from db/seed.sql

INSERT INTO accounts (account_number, name, balance, pin, status) VALUES
  ('12345', 'Roel Richard',        5000.00, '1111', 'Active'),
  ('23456', 'Dorie Marie',            0.00, '2222', 'Active'),
  ('34567', 'Railee Darrel',       10000.00, '3333', 'Active'),
  ('45678', 'Railynne Dessirei',    2500.00, '4444', 'Active'),
  ('56789', 'Raine Dessirei',      10000.00, '5555', 'Locked'),
  ('0000',  'Administrator',           0.00, '0000', 'Active')
ON CONFLICT (account_number) DO NOTHING;