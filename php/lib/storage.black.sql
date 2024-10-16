CREATE TABLE IF NOT EXISTS Base (
	id INT PRIMARY KEY AUTO_INCREMENT
);

CREATE TABLE IF NOT EXISTS test (
	id INT PRIMARY KEY AUTO_INCREMENT,
	file MEDIUMBLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS subscription_type (
	id INT PRIMARY KEY AUTO_INCREMENT,
	name VARCHAR(40) NOT NULL UNIQUE,
	duration BIGINT UNSIGNED NOT NULL,
	storage BIGINT UNSIGNED NOT NULL
);

INSERT INTO subscription_type (name, duration, storage)
VALUES
	("free", 1578000000, 25000000), /* 50 years, 25 MB */
	("pro", 2592000, 10000000000); /* 30 days,  10 GB */

CREATE TABLE IF NOT EXISTS activation_keys (
	id INT PRIMARY KEY AUTO_INCREMENT,
	code BINARY(16) NOT NULL UNIQUE,
	subscription_type_id INT NOT NULL,

	FOREIGN KEY (subscription_type_id) REFERENCES subscription_type(id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
	id INT PRIMARY KEY AUTO_INCREMENT,
	subscription_type_id INT NOT NULL,
	expire_date BIGINT UNSIGNED NOT NULL,
	storage_left BIGINT UNSIGNED NOT NULL,

	FOREIGN KEY (subscription_type_id) REFERENCES subscription_type(id)
);

CREATE TABLE IF NOT EXISTS accounts (
	id INT PRIMARY KEY AUTO_INCREMENT,
	account_hash BINARY(32) NOT NULL UNIQUE,
	subscription_id INT NOT NULL UNIQUE,
	
	FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE TABLE IF NOT EXISTS files (
	id INT PRIMARY KEY AUTO_INCREMENT,
	account_id INT NOT NULL,
	data_id BINARY(16) NOT NULL,
	file_data VARBINARY(255) NOT NULL,
	encryption_data BINARY(104) NOT NULL,
	file_size BIGINT UNSIGNED NOT NULL,
	finished_writing BOOLEAN NOT NULL,
	
	FOREIGN KEY (account_id) REFERENCES accounts(id)
);

/* dummy data */

INSERT INTO subscriptions(subscription_type_id, expire_date, storage_left)
	VALUES (1, 1828976715, 10000000);

INSERT INTO accounts(account_hash, subscription_id)
	VALUES ("12345678901234567890123456789012", 1);

INSERT INTO files(account_id, data_id, file_data, encryption_data, file_size, finished_writing)
	VALUES
		(1, "root data", "buh", "buh2", 123, 1),
		(1, "data", "buh", "buh2", 321, 0),
		(1, "data", "buh135", "buh24563456", 444, 0);

SELECT file_data FROM files
INNER JOIN accounts ON accounts.account_hash = "12345678901234567890123456789012"
WHERE accounts.id = files.account_id;