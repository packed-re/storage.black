<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/utility.php");

	$_fileSecret = hex2bin("344a9ae07e411b3c1bfb61636bfa717be9641a16055bdae782470c0f8d24b017");

	class Database
	{
		protected $DB;

		public function __construct()
		{
			$this->DB = new mysqli("localhost", "root", "", "storage.black");
			if ($this->DB->connect_error)
				ExitResponse(ResponseType::ServerError, "SQL Conn Failed: " . $this->DB->connect_error, true);
		}

		protected function DeleteTableRowByID($table_name, $id)
		{
			$this->DB->query("DELETE FROM $table_name WHERE id=$id LIMIT 1;");

			return $this->DB->affected_rows === 1;
		}

		public function CreateAccount($account_hash) // get data -> delete code -> create sub. this ensures atomicity
		{
			$stmt = $this->DB->prepare("
				INSERT INTO accounts (account_hash) VALUES (?);
			");

			$stmt->bind_param("s", $account_hash);
			$stmt->execute();

			return $this->DB->affected_rows === 1;
		}

		public function AccountExists($account_hash)
		{
			$stmt = $this->DB->prepare("
				SELECT id FROM accounts WHERE account_hash = ? LIMIT 1;
			");

			$stmt->bind_param("s", $account_hash);
			$stmt->execute();

			return $stmt->get_result()->num_rows === 1;
		}

		public function RegisterFile($account_hash, $data_id, $file_data, $file_size, $__call_depth = 0)
		{
			global $_fileSecret;
			
			$stmt = $this->DB->prepare("
				INSERT INTO files (account_id, data_id, file_id, file_data, file_size, finished_writing)
					SELECT id, ?, ?, ?, ?, 0 FROM accounts
						WHERE account_hash = ?;
			");

			//file_id - hmac(data_id + (initial) meta_data + rand + account_id, secret)
			//file_on_disk - hmac(file_id + file_size, hmac(account_id, secret))

			$fileId = hash_hmac("sha256", $data_id . $file_data . random_bytes(32) . $account_hash, $_fileSecret, true);
			$fileId = ByteSubString($fileId, 0, 16) ^ ByteSubString($fileId, 16, 16);
			//ExitResponse(ResponseType::ServerError, "---" . implode("\n---", [$data_id, $fileId, $file_data, $file_size, $account_hash]));
			$stmt->bind_param("sssis", $data_id, $fileId, $file_data, $file_size, $account_hash);
			$stmt->execute();

			if($this->DB->affected_rows === 0) // if no account exists with given account hash
			{
				if($__call_depth > 0)
					ExitResponse(ResponseType::ServerError, "call depth exceeded in RegisterFile", true);

				$this->CreateAccount($account_hash);
				return $this->RegisterFile($account_hash, $data_id, $file_data, $file_size, $__call_depth + 1);
			}
			else
				return $fileId;
		}

		public function UnregisterFile($account_hash, $fileId)
		{
			$stmt = $this->DB->prepare("
				DELETE FROM files
				WHERE file_id = ? AND account_id =
					(
						SELECT id
						FROM accounts
						WHERE account_hash = ?
					);
			");

			$stmt->bind_param("ss", $fileId, $account_hash);
			$stmt->execute();

			return $this->DB->affected_rows === 1;
		}

		public function FinishFileUpload($account_hash, $fileId)
		{
			$stmt = $this->DB->prepare("
				UPDATE files
					INNER JOIN accounts ON accounts.account_hash = ?
				SET files.finished_writing = 1
				WHERE files.file_id = ?
				LIMIT 1;
			");			
			
			$stmt->bind_param("ss", $account_hash, $fileId);
			$stmt->execute();

			return $this->DB->affected_rows === 1;
		}

		public function ListFiles($account_hash, $data_id) // remake this to also delete old unfinished files
		{
			$stmt = $this->DB->prepare("
				SELECT files.file_id, files.file_data, files.file_size FROM files
				INNER JOIN accounts ON accounts.account_hash = ?
				WHERE accounts.id = files.account_id AND files.data_id = ? AND files.finished_writing = 1
			");

			$stmt->bind_param("ss", $account_hash, $data_id);
			$stmt->execute();

			$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

			return $rows;
		}

		public function GetFileSize($fileId)
		{
			$stmt = $this->DB->prepare("
				SELECT files.file_size FROM files WHERE files.file_id = ?
			");

			$stmt->bind_param("s", $fileId);
			$stmt->execute();

			$result = $stmt->get_result()->fetch_assoc();
			if(!$result)
				return null;
			else
				return $result["file_size"];
		}
	}
?>