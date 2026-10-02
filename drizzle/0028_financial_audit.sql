-- Financial writes and their audit events commit in the same D1 transaction.
-- Corrections must append compensating entries; never rewrite money history.
CREATE TABLE finance_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('baseline', 'insert', 'update')),
  old_payload TEXT,
  new_payload TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_finance_audit_record ON finance_audit_events (table_name, record_key, id);
CREATE TRIGGER finance_audit_no_update BEFORE UPDATE ON finance_audit_events BEGIN SELECT RAISE(ABORT, 'Financial audit events are immutable'); END;
CREATE TRIGGER finance_audit_no_delete BEFORE DELETE ON finance_audit_events BEGIN SELECT RAISE(ABORT, 'Financial audit events are immutable'); END;

CREATE TABLE finance_backup_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_event_id INTEGER NOT NULL DEFAULT 0,
  last_chunk_key TEXT,
  last_sha256 TEXT,
  last_success_at TEXT,
  last_checked_at TEXT,
  last_error TEXT
);
INSERT INTO finance_backup_state (id) VALUES (1);

-- wallet_transactions
INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) SELECT 'wallet_transactions', CAST(id AS TEXT), 'baseline', json_object('id', id, 'user_id', user_id, 'kind', kind, 'amount', amount, 'order_code', order_code, 'reference', reference, 'target_type', target_type, 'target_id', target_id, 'seller_user_id', seller_user_id, 'description', description, 'created_at', created_at, 'wallet', wallet) FROM wallet_transactions ORDER BY id;
CREATE TRIGGER wallet_transactions_audit_insert AFTER INSERT ON wallet_transactions BEGIN
  INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) VALUES ('wallet_transactions', CAST(NEW.id AS TEXT), 'insert', json_object('id', NEW.id, 'user_id', NEW.user_id, 'kind', NEW.kind, 'amount', NEW.amount, 'order_code', NEW.order_code, 'reference', NEW.reference, 'target_type', NEW.target_type, 'target_id', NEW.target_id, 'seller_user_id', NEW.seller_user_id, 'description', NEW.description, 'created_at', NEW.created_at, 'wallet', NEW.wallet));
END;
CREATE TRIGGER wallet_transactions_no_delete BEFORE DELETE ON wallet_transactions BEGIN SELECT RAISE(ABORT, 'Financial records cannot be deleted'); END;
CREATE TRIGGER wallet_transactions_no_update BEFORE UPDATE ON wallet_transactions BEGIN SELECT RAISE(ABORT, 'Financial records are immutable; append a correction'); END;

-- wallet_manual_credits
INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) SELECT 'wallet_manual_credits', CAST(reference AS TEXT), 'baseline', json_object('reference', reference, 'user_id', user_id, 'amount', amount, 'order_code', order_code, 'reason', reason, 'performed_by', performed_by, 'created_at', created_at) FROM wallet_manual_credits ORDER BY reference;
CREATE TRIGGER wallet_manual_credits_audit_insert AFTER INSERT ON wallet_manual_credits BEGIN
  INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) VALUES ('wallet_manual_credits', CAST(NEW.reference AS TEXT), 'insert', json_object('reference', NEW.reference, 'user_id', NEW.user_id, 'amount', NEW.amount, 'order_code', NEW.order_code, 'reason', NEW.reason, 'performed_by', NEW.performed_by, 'created_at', NEW.created_at));
END;
CREATE TRIGGER wallet_manual_credits_no_delete BEFORE DELETE ON wallet_manual_credits BEGIN SELECT RAISE(ABORT, 'Financial records cannot be deleted'); END;
CREATE TRIGGER wallet_manual_credits_no_update BEFORE UPDATE ON wallet_manual_credits BEGIN SELECT RAISE(ABORT, 'Financial records are immutable; append a correction'); END;

-- wallet_sale_credits
INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) SELECT 'wallet_sale_credits', CAST(purchase_id AS TEXT), 'baseline', json_object('purchase_id', purchase_id, 'seller_user_id', seller_user_id, 'amount', amount, 'reviewed_by', reviewed_by, 'created_at', created_at, 'revoked_by', revoked_by, 'revoked_at', revoked_at, 'revocation_reason', revocation_reason, 'admin_percent', admin_percent, 'gross_amount', gross_amount) FROM wallet_sale_credits ORDER BY purchase_id;
CREATE TRIGGER wallet_sale_credits_audit_insert AFTER INSERT ON wallet_sale_credits BEGIN
  INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) VALUES ('wallet_sale_credits', CAST(NEW.purchase_id AS TEXT), 'insert', json_object('purchase_id', NEW.purchase_id, 'seller_user_id', NEW.seller_user_id, 'amount', NEW.amount, 'reviewed_by', NEW.reviewed_by, 'created_at', NEW.created_at, 'revoked_by', NEW.revoked_by, 'revoked_at', NEW.revoked_at, 'revocation_reason', NEW.revocation_reason, 'admin_percent', NEW.admin_percent, 'gross_amount', NEW.gross_amount));
END;
CREATE TRIGGER wallet_sale_credits_no_delete BEFORE DELETE ON wallet_sale_credits BEGIN SELECT RAISE(ABORT, 'Financial records cannot be deleted'); END;
CREATE TRIGGER wallet_sale_credits_protect_money BEFORE UPDATE ON wallet_sale_credits
WHEN NEW.purchase_id IS NOT OLD.purchase_id OR NEW.seller_user_id IS NOT OLD.seller_user_id OR NEW.amount IS NOT OLD.amount OR NEW.reviewed_by IS NOT OLD.reviewed_by OR NEW.created_at IS NOT OLD.created_at OR NEW.admin_percent IS NOT OLD.admin_percent OR NEW.gross_amount IS NOT OLD.gross_amount
BEGIN SELECT RAISE(ABORT, 'Original financial values are immutable'); END;
CREATE TRIGGER wallet_sale_credits_audit_update AFTER UPDATE ON wallet_sale_credits BEGIN
  INSERT INTO finance_audit_events (table_name, record_key, operation, old_payload, new_payload) VALUES ('wallet_sale_credits', CAST(NEW.purchase_id AS TEXT), 'update', json_object('purchase_id', OLD.purchase_id, 'seller_user_id', OLD.seller_user_id, 'amount', OLD.amount, 'reviewed_by', OLD.reviewed_by, 'created_at', OLD.created_at, 'revoked_by', OLD.revoked_by, 'revoked_at', OLD.revoked_at, 'revocation_reason', OLD.revocation_reason, 'admin_percent', OLD.admin_percent, 'gross_amount', OLD.gross_amount), json_object('purchase_id', NEW.purchase_id, 'seller_user_id', NEW.seller_user_id, 'amount', NEW.amount, 'reviewed_by', NEW.reviewed_by, 'created_at', NEW.created_at, 'revoked_by', NEW.revoked_by, 'revoked_at', NEW.revoked_at, 'revocation_reason', NEW.revocation_reason, 'admin_percent', NEW.admin_percent, 'gross_amount', NEW.gross_amount));
END;

-- wallet_withdrawals
INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) SELECT 'wallet_withdrawals', CAST(id AS TEXT), 'baseline', json_object('id', id, 'user_id', user_id, 'amount', amount, 'bank_name', bank_name, 'account_number', account_number, 'account_name', account_name, 'status', status, 'review_note', review_note, 'reviewed_by', reviewed_by, 'reviewed_at', reviewed_at, 'created_at', created_at) FROM wallet_withdrawals ORDER BY id;
CREATE TRIGGER wallet_withdrawals_audit_insert AFTER INSERT ON wallet_withdrawals BEGIN
  INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) VALUES ('wallet_withdrawals', CAST(NEW.id AS TEXT), 'insert', json_object('id', NEW.id, 'user_id', NEW.user_id, 'amount', NEW.amount, 'bank_name', NEW.bank_name, 'account_number', NEW.account_number, 'account_name', NEW.account_name, 'status', NEW.status, 'review_note', NEW.review_note, 'reviewed_by', NEW.reviewed_by, 'reviewed_at', NEW.reviewed_at, 'created_at', NEW.created_at));
END;
CREATE TRIGGER wallet_withdrawals_no_delete BEFORE DELETE ON wallet_withdrawals BEGIN SELECT RAISE(ABORT, 'Financial records cannot be deleted'); END;
CREATE TRIGGER wallet_withdrawals_protect_money BEFORE UPDATE ON wallet_withdrawals
WHEN NEW.id IS NOT OLD.id OR NEW.user_id IS NOT OLD.user_id OR NEW.amount IS NOT OLD.amount OR NEW.bank_name IS NOT OLD.bank_name OR NEW.account_number IS NOT OLD.account_number OR NEW.account_name IS NOT OLD.account_name OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT, 'Original financial values are immutable'); END;
CREATE TRIGGER wallet_withdrawals_audit_update AFTER UPDATE ON wallet_withdrawals BEGIN
  INSERT INTO finance_audit_events (table_name, record_key, operation, old_payload, new_payload) VALUES ('wallet_withdrawals', CAST(NEW.id AS TEXT), 'update', json_object('id', OLD.id, 'user_id', OLD.user_id, 'amount', OLD.amount, 'bank_name', OLD.bank_name, 'account_number', OLD.account_number, 'account_name', OLD.account_name, 'status', OLD.status, 'review_note', OLD.review_note, 'reviewed_by', OLD.reviewed_by, 'reviewed_at', OLD.reviewed_at, 'created_at', OLD.created_at), json_object('id', NEW.id, 'user_id', NEW.user_id, 'amount', NEW.amount, 'bank_name', NEW.bank_name, 'account_number', NEW.account_number, 'account_name', NEW.account_name, 'status', NEW.status, 'review_note', NEW.review_note, 'reviewed_by', NEW.reviewed_by, 'reviewed_at', NEW.reviewed_at, 'created_at', NEW.created_at));
END;

-- wallet_topup_requests
INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) SELECT 'wallet_topup_requests', CAST(id AS TEXT), 'baseline', json_object('id', id, 'request_code', request_code, 'user_id', user_id, 'amount', amount, 'transfer_content', transfer_content, 'status', status, 'reviewed_by', reviewed_by, 'reviewed_at', reviewed_at, 'created_at', created_at, 'updated_at', updated_at) FROM wallet_topup_requests ORDER BY id;
CREATE TRIGGER wallet_topup_requests_audit_insert AFTER INSERT ON wallet_topup_requests BEGIN
  INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) VALUES ('wallet_topup_requests', CAST(NEW.id AS TEXT), 'insert', json_object('id', NEW.id, 'request_code', NEW.request_code, 'user_id', NEW.user_id, 'amount', NEW.amount, 'transfer_content', NEW.transfer_content, 'status', NEW.status, 'reviewed_by', NEW.reviewed_by, 'reviewed_at', NEW.reviewed_at, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at));
END;
CREATE TRIGGER wallet_topup_requests_no_delete BEFORE DELETE ON wallet_topup_requests BEGIN SELECT RAISE(ABORT, 'Financial records cannot be deleted'); END;
CREATE TRIGGER wallet_topup_requests_protect_money BEFORE UPDATE ON wallet_topup_requests
WHEN NEW.id IS NOT OLD.id OR NEW.request_code IS NOT OLD.request_code OR NEW.user_id IS NOT OLD.user_id OR NEW.amount IS NOT OLD.amount OR NEW.transfer_content IS NOT OLD.transfer_content OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT, 'Original financial values are immutable'); END;
CREATE TRIGGER wallet_topup_requests_audit_update AFTER UPDATE ON wallet_topup_requests BEGIN
  INSERT INTO finance_audit_events (table_name, record_key, operation, old_payload, new_payload) VALUES ('wallet_topup_requests', CAST(NEW.id AS TEXT), 'update', json_object('id', OLD.id, 'request_code', OLD.request_code, 'user_id', OLD.user_id, 'amount', OLD.amount, 'transfer_content', OLD.transfer_content, 'status', OLD.status, 'reviewed_by', OLD.reviewed_by, 'reviewed_at', OLD.reviewed_at, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at), json_object('id', NEW.id, 'request_code', NEW.request_code, 'user_id', NEW.user_id, 'amount', NEW.amount, 'transfer_content', NEW.transfer_content, 'status', NEW.status, 'reviewed_by', NEW.reviewed_by, 'reviewed_at', NEW.reviewed_at, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at));
END;

-- wallet_sale_settings
INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) SELECT 'wallet_sale_settings', CAST(id AS TEXT), 'baseline', json_object('id', id, 'admin_percent', admin_percent, 'updated_by', updated_by, 'updated_at', updated_at) FROM wallet_sale_settings ORDER BY id;
CREATE TRIGGER wallet_sale_settings_audit_insert AFTER INSERT ON wallet_sale_settings BEGIN
  INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) VALUES ('wallet_sale_settings', CAST(NEW.id AS TEXT), 'insert', json_object('id', NEW.id, 'admin_percent', NEW.admin_percent, 'updated_by', NEW.updated_by, 'updated_at', NEW.updated_at));
END;
CREATE TRIGGER wallet_sale_settings_no_delete BEFORE DELETE ON wallet_sale_settings BEGIN SELECT RAISE(ABORT, 'Financial records cannot be deleted'); END;
CREATE TRIGGER wallet_sale_settings_protect_money BEFORE UPDATE ON wallet_sale_settings
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'Original financial values are immutable'); END;
CREATE TRIGGER wallet_sale_settings_audit_update AFTER UPDATE ON wallet_sale_settings BEGIN
  INSERT INTO finance_audit_events (table_name, record_key, operation, old_payload, new_payload) VALUES ('wallet_sale_settings', CAST(NEW.id AS TEXT), 'update', json_object('id', OLD.id, 'admin_percent', OLD.admin_percent, 'updated_by', OLD.updated_by, 'updated_at', OLD.updated_at), json_object('id', NEW.id, 'admin_percent', NEW.admin_percent, 'updated_by', NEW.updated_by, 'updated_at', NEW.updated_at));
END;

-- payment_orders
INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) SELECT 'payment_orders', CAST(id AS TEXT), 'baseline', json_object('id', id, 'order_code', order_code, 'buyer_user_id', buyer_user_id, 'buyer_name', buyer_name, 'buyer_email', buyer_email, 'seller_user_id', seller_user_id, 'target_type', target_type, 'target_id', target_id, 'product_title', product_title, 'amount', amount, 'provider', provider, 'payment_link_id', payment_link_id, 'checkout_url', checkout_url, 'status', status, 'transaction_reference', transaction_reference, 'paid_at', paid_at, 'created_at', created_at, 'updated_at', updated_at) FROM payment_orders ORDER BY id;
CREATE TRIGGER payment_orders_audit_insert AFTER INSERT ON payment_orders BEGIN
  INSERT INTO finance_audit_events (table_name, record_key, operation, new_payload) VALUES ('payment_orders', CAST(NEW.id AS TEXT), 'insert', json_object('id', NEW.id, 'order_code', NEW.order_code, 'buyer_user_id', NEW.buyer_user_id, 'buyer_name', NEW.buyer_name, 'buyer_email', NEW.buyer_email, 'seller_user_id', NEW.seller_user_id, 'target_type', NEW.target_type, 'target_id', NEW.target_id, 'product_title', NEW.product_title, 'amount', NEW.amount, 'provider', NEW.provider, 'payment_link_id', NEW.payment_link_id, 'checkout_url', NEW.checkout_url, 'status', NEW.status, 'transaction_reference', NEW.transaction_reference, 'paid_at', NEW.paid_at, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at));
END;
CREATE TRIGGER payment_orders_no_delete BEFORE DELETE ON payment_orders BEGIN SELECT RAISE(ABORT, 'Financial records cannot be deleted'); END;
CREATE TRIGGER payment_orders_protect_money BEFORE UPDATE ON payment_orders
WHEN NEW.id IS NOT OLD.id OR NEW.order_code IS NOT OLD.order_code OR NEW.buyer_user_id IS NOT OLD.buyer_user_id OR NEW.seller_user_id IS NOT OLD.seller_user_id OR NEW.target_type IS NOT OLD.target_type OR NEW.target_id IS NOT OLD.target_id OR NEW.amount IS NOT OLD.amount OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT, 'Original financial values are immutable'); END;
CREATE TRIGGER payment_orders_audit_update AFTER UPDATE ON payment_orders BEGIN
  INSERT INTO finance_audit_events (table_name, record_key, operation, old_payload, new_payload) VALUES ('payment_orders', CAST(NEW.id AS TEXT), 'update', json_object('id', OLD.id, 'order_code', OLD.order_code, 'buyer_user_id', OLD.buyer_user_id, 'buyer_name', OLD.buyer_name, 'buyer_email', OLD.buyer_email, 'seller_user_id', OLD.seller_user_id, 'target_type', OLD.target_type, 'target_id', OLD.target_id, 'product_title', OLD.product_title, 'amount', OLD.amount, 'provider', OLD.provider, 'payment_link_id', OLD.payment_link_id, 'checkout_url', OLD.checkout_url, 'status', OLD.status, 'transaction_reference', OLD.transaction_reference, 'paid_at', OLD.paid_at, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at), json_object('id', NEW.id, 'order_code', NEW.order_code, 'buyer_user_id', NEW.buyer_user_id, 'buyer_name', NEW.buyer_name, 'buyer_email', NEW.buyer_email, 'seller_user_id', NEW.seller_user_id, 'target_type', NEW.target_type, 'target_id', NEW.target_id, 'product_title', NEW.product_title, 'amount', NEW.amount, 'provider', NEW.provider, 'payment_link_id', NEW.payment_link_id, 'checkout_url', NEW.checkout_url, 'status', NEW.status, 'transaction_reference', NEW.transaction_reference, 'paid_at', NEW.paid_at, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at));
END;
