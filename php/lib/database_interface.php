<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");

	function GetManagedFileName($account_hash, $data_id, $file_data, $file_size)
	{

	}

	class FileDatabse
	{
		protected $DB;

		public function __construct()
		{
			$this->DB = new mysqli("localhost", "root", "", "storage.black");
			if ($this->DB->connect_error)
				ExitResponse(ResponseType::ServerError, CreateSecureResponseData("SQL Conn Failed: " . $this->DB>connect_error));
		}

		public function BlobUpTest($binary_data)
		{
			$stmt = $this->DB->prepare("INSERT INTO test(file)
			                            VALUES (?)");			
			
			$stmt->bind_param("b", $binary_data); // even if i upload 5 bytes this dogshit language refuses to send them, so I'm basically forced to always use send_long_data
			$stmt->send_long_data(0, $binary_data);
			$stmt->execute();
		}

		public function BlobDownTest()
		{			
			return $this->DB->query("SELECT file FROM test ORDER BY ID DESC LIMIT 1")
			       ->fetch_row()[0];
		}

		public function CreateSubscription($type_id)
		{

		}

		public function CreateAcivationCodes($count) // returns as hex. what is stored in the db should be different from what is deemed a valid code - db[id] = hash(actual_code)
		{

		}

		public function _GetCodeData($code)
		{
			$stmt = $this->DB->prepare("
				SELECT subscription_type.name, subscription_type.duration, subscription_type.storage FROM activation_keys
					INNER JOIN subscriptions ON accounts.subscription_id = subscriptions.id
					INNER JOIN subscription_type ON subscriptions.subscription_type_id = subscription_type.id
				WHERE accounts.account_hash = ?
				LIMIT 1
			");			
		
			$stmt->bind_param("s", $account_hash);
			$stmt->execute();

			return $stmt->get_result()->fetch_assoc();
		}

		public function ActivateCode($code, $account_hash = null) // expects hex, returns bool. if account_id is -1 it will create a new one IF the code is valid
		{

		}

		public function CreateAccount($account_hash, $subscription_id = 1) // get data -> delete code -> create sub, this ensures atomicity
		{

		}

		public function TryReserveSpace($account_hash, $amount)
		{
			$stmt = $this->DB->prepare("
				UPDATE accounts
					INNER JOIN subscriptions ON subscriptions.id = accounts.subscription_id
				SET subscriptions.storage_left = IF(subscriptions.storage_left >= ? AND subscriptions.expire_date > UNIX_TIMESTAMP(), subscriptions.storage_left - ?, subscriptions.storage_left)
				WHERE accounts.account_hash = ?
				LIMIT 1;
			");			
			
			$stmt->bind_param("iis", $amount, $amount, $account_hash);
			$stmt->execute();

			return $this->DB->affected_rows === 1;
		}

		public function FetchAccountData($account_hash)
		{
			$stmt = $this->DB->prepare("
				SELECT subscriptions.expire_date, subscriptions.storage_left, subscription_type.storage as storage_max FROM accounts
					INNER JOIN subscriptions ON accounts.subscription_id = subscriptions.id
					INNER JOIN subscription_type ON subscriptions.subscription_type_id = subscription_type.id
				WHERE accounts.account_hash = ?
				LIMIT 1
			");			
			
			$stmt->bind_param("s", $account_hash);
			$stmt->execute();

			return $stmt->get_result()->fetch_assoc();
		}

		public function RegisterFile($account_hash, $data_id, $file_data, $encryption_data, $file_size, $__call_depth = 0) // create account if one doesnt exist
		{
			$stmt = $this->DB->prepare("
				INSERT INTO files (account_id, data_id, file_data, encryption_data, finished_writing)
					SELECT id, ?, ?, ?, 0 FROM accounts
						WHERE account_hash = ?;
			");

			$stmt->bind_param("ssssi", $data_id, $file_data, $encryption_data, $account_hash, $file_size);
			$stmt->execute();

			if($this->DB->affected_rows === 0)
			{
				if($__call_depth > 0)
					ExitResponse(ResponseType::ServerError, CreateSecureResponseData("call depth exceeded in RegisterFile"));

				$this->CreateAccount($account_hash);
				return $this->RegisterFile($account_hash, $data_id, $file_data, $file_size, $encryption_data, $__call_depth + 1);
			}
			else
				return true;
		}

		public function FinishFileUpload($account_hash, $data_id, $file_data, $encryption_data, $file_size)
		{
			$stmt = $this->DB->prepare("
				UPDATE files
					INNER JOIN accounts ON subscriptions.id = accounts.subscription_id
				SET subscriptions.storage_left = IF(subscriptions.storage_left >= ?, subscriptions.storage_left - ?, subscriptions.storage_left)
				WHERE accounts.account_hash = ?
				LIMIT 1;
			");			
			
			$stmt->bind_param("iis", $amount, $amount, $account_hash);
			$stmt->execute();

			return $this->DB->affected_rows === 1;
		}

		public function ListFiles($account_hash)
		{
			$stmt = $this->DB->prepare("
				SELECT data_id, file_data, encryption_data, file_size FROM files
				INNER JOIN accounts ON accounts.account_hash = ?
				WHERE accounts.id = files.account_id AND finished_writing = 1;
			");

			$stmt->bind_param("s", $account_hash);
			$stmt->execute();

			$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

			$out = [];
			$rowCount = count($rows);
			for($i = 0; $i < $rowCount; ++$i)
			{
				$data_id = $rows[$i]["data_id"];
				if(!isset($out[$data_id]))
					$out[$data_id] = [];

				$out[$data_id][] = [
					"data" => $rows[$i]["file_data"],
					"encryption_data" => $rows[$i]["encryption_data"],
					"size" => $rows[$i]["file_size"]
				];
			}

			return $out;
		}
	}
?>