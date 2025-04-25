CREATE TABLE IF NOT EXISTS accounts (
	id INT PRIMARY KEY AUTO_INCREMENT,
	account_hash BINARY(32) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS files (
	id INT PRIMARY KEY AUTO_INCREMENT,
	account_id INT NOT NULL,
	data_id BINARY(16) NOT NULL,
	file_id BINARY(16) NOT NULL,
	file_data VARBINARY(255) NOT NULL,
	file_size BIGINT UNSIGNED NOT NULL,
	finished_writing BOOLEAN NOT NULL,
	
	FOREIGN KEY (account_id) REFERENCES accounts(id)
);

/* dummy data */

INSERT INTO accounts(account_hash)
	VALUES ("12345678901234567890123456789012");

INSERT INTO files(account_id, data_id, file_id, file_data, file_size, finished_writing)
	VALUES
		(1, "root data", "fid", "fileId", 123, 1),
		(1, "data", "fileId123", "fileId3", 321, 0),
		(1, "data", "fileID", "fileI5d", 444, 0);

SELECT file_data FROM files
INNER JOIN accounts ON accounts.account_hash = "12345678901234567890123456789012"
WHERE accounts.id = files.account_id;