<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");
	

	$___name_hash_salt = hex2bin("a2c90fe3dfab12c3799ad5a0b2b7e355");

	function GetManagedFileNameFromHash($hash) // we use this in DeleteUnfinishedFiles
	{
		return $_SERVER["DOCUMENT_ROOT"] . "/files/" . bin2hex(ByteSubString($hash, 0, 16) ^ ByteSubString($hash, 16));
	}

	function GetManagedFileName($account_hash, $data_id, $file_data, $encryption_data, $file_size)
	{
		global $___name_hash_salt;

		return GetManagedFileNameFromHash(
			hash("sha256", $account_hash . $data_id . $file_data . $encryption_data . $file_size . $___name_hash_salt)
		);
	}

	$___db_activation_code_salt = hex2bin("344a9ae07e411b3c1bfb61636bfa717be9641a16055bdae782470c0f8d24b017");

	function _CreateDBActivationCode($code)
	{
		global $___db_activation_code_salt;

		$hash = hash("sha256", $code . $___db_activation_code_salt, true);

		return ByteSubString($hash, 0, 16) ^ ByteSubString($hash, 16, 16);
	}

	class FileDatabse
	{
		protected $DB;

		public function __construct()
		{
			$this->DB = new mysqli("localhost", "root", "", "storage.black");
			if ($this->DB->connect_error)
				ExitResponse(ResponseType::ServerError, "SQL Conn Failed: " . $this->DB>connect_error, true);
		}

		protected function DeleteTableRowByID($table_name, $id)
		{
			$this->DB->query("DELETE FROM $table_name WHERE id=$id;");

			return $this->DB->affected_rows === 1;
		}

		public function BlobUpTest($binary_data)
		{
			$stmt = $this->DB->prepare("INSERT INTO test(file)
			                            VALUES (?)");			
			
			$stmt->bind_param("b", $binary_data);
			$stmt->send_long_data(0, $binary_data);
			$stmt->execute();
		}

		public function BlobDownTest()
		{			
			return $this->DB->query("SELECT file FROM test ORDER BY ID DESC LIMIT 1")
			       ->fetch_row()[0];
		}

		protected function DeleteUnfinishedFiles($account_hash = null, $data_id = null) // null for either param means itll be disregarded in the WHERE clause
		{
			global $___name_hash_salt;

			$rows = $this->DB->query("
				SELECT 
				SHA2(
					CONCAT(
						accounts.account_hash,
						files.data_id,
						files.file_data,
						files.encryption_data,
						files.file_size,
						" . MYSQLMakeString($this->DB, $___name_hash_salt) . "
					), 256),
					files.file_size
				FROM accounts
				INNER JOIN files ON files.account_id = accounts.id
				WHERE " . ($account_hash !== null ? "accounts.account_hash = " . MYSQLMakeString($this->DB, $account_hash) . " AND " : "") .
				          ($data_id !== null ? "files.data_id = " . MYSQLMakeString($this->DB, $data_id) . " AND " : "") .
						  "files.finished_writing = 0
			")->fetch_all(MYSQLI_NUM);

			$rowCount = count($rows);
			for($i = 0; $i < $rowCount; ++$i)
			{
				echo sprintf("%s<br>", GetManagedFileNameFromHash($rows[$i][0]));
			}
		}

		public function PerformCleanup() // do things like cleaning up dead subscriptions, replacing expired subscriptions with free ones, deleting expired files, etc. Should be called from a single global source.
		{
			throw "not implemented";
		}

		protected function CreateSubscription($subscription_type_id)
		{
			$stmt = $this->DB->prepare("
				INSERT INTO subscriptions (subscription_type_id, expire_date, storage_left)
				SELECT id, UNIX_TIMESTAMP() + duration, storage
				FROM subscription_type
				WHERE id = ?;
			");			
		
			$stmt->bind_param("i", $subscription_type_id);
			$stmt->execute();

			return $this->DB->affected_rows === 1 ? $this->DB->insert_id : null;
		}

		public function CreateSubscriptionByTypeName($type_name)
		{
			$stmt = $this->DB->prepare("
				INSERT INTO subscriptions (subscription_type_id, expire_date, storage_left)
				SELECT id, UNIX_TIMESTAMP() + duration, storage
				FROM subscription_type
				WHERE name = ?;
			");			
		
			$stmt->bind_param("s", $type_name);
			$stmt->execute();

			return $this->DB->affected_rows === 1 ? $this->DB->insert_id : null;
		}

		protected function SetAccountSubscriptionID($account_hash, $subscription_id)
		{
			$stmt = $this->DB->prepare("
				UPDATE accounts
				SET subscription_id = ?
				WHERE account_hash = ?;
			");			
			
			$stmt->bind_param("is", $subscription_id, $account_hash);
			$stmt->execute();

			return $this->DB->affected_rows === 1;
		}

		public function ListSubscriptionTypes() // returns id, name, duration, storage. id is used in CreateActivationCodes
		{

		}

		public function GetSubscriptionTypeDataByName($name)
		{
			$stmt = $this->DB->prepare("
				SELECT id, duration, storage FROM subscription_type WHERE name = ? LIMIT 1;
			");

			$stmt->bind_param("s", $name);
			$stmt->execute();

			return $stmt->get_result()->fetch_assoc();
		}

		protected function InsertActivationCodeRaw($code, $subscription_type_id)
		{
			$this->DB->query("
				INSERT INTO activation_keys (code, subscription_type_id) VALUES (" .  MYSQLMakeString($this->DB, $code) . ", $subscription_type_id)
			");

			return $this->DB->affected_rows === 1;
		}

		public function CreateActivationCodes($count, $subscription_type_id) // returns as hex. what is stored in the db should be different from what is deemed a valid code - db[id] = hash(actual_code)
		{			
			if($count <= 0)
				return [];

			$codes = [random_bytes(16)];
			$insert_values = "(" . MYSQLMakeString($this->DB, _CreateDBActivationCode($codes[0])) . ",$subscription_type_id)";

			for($i = 1; $i < $count; ++$i)
			{
				$codes[$i] = random_bytes(16);
				$insert_values .= ",(" . MYSQLMakeString($this->DB, _CreateDBActivationCode($codes[$i])) . ",$subscription_type_id)";
			}

			$insert_values .= ";";

			$this->DB->query("
				INSERT INTO activation_keys (code, subscription_type_id) VALUES $insert_values
			");

			if($this->DB->affected_rows !== $count)
				return null;

			return $codes;
		}

		public function GetCodeData($code)
		{
			return $this->DB->query("
				SELECT
					activation_keys.subscription_type_id,
					subscription_type.name,
					subscription_type.duration,
					subscription_type.storage
				FROM activation_keys
					INNER JOIN subscription_type ON subscription_type.id = activation_keys.subscription_type_id
				WHERE activation_keys.code = " . MYSQLMakeString($this->DB, _CreateDBActivationCode($code)) . "
				LIMIT 1;
			")->fetch_assoc();
		}

		protected function ExtendSubscriptionDuration($account_hash, $amount) // make sure the type ids match before doing this
		{
			$stmt = $this->DB->prepare("
				UPDATE accounts
					INNER JOIN subscriptions ON subscriptions.id = accounts.subscription_id
				SET subscriptions.expire_date = subscriptions.expire_date + ?
				WHERE accounts.account_hash = ?
				LIMIT 1;
			");			
			
			$stmt->bind_param("is", $amount, $account_hash);
			$stmt->execute();

			return $this->DB->affected_rows === 1;
		}

		public function RedeemCode($account_hash, $code) // expects binary string and the key to be valid (through GetCodeData). false if key couldnt be found, true if it was applied
		{
			// this system is bad. change this asap

			$code_data = $this->GetCodeData($code); //did this because we'll be calling it externally anyway for ExtendSubscriptionDuration
			if($code_data === null)
				return false;

			$this->DB->query("
				DELETE FROM activation_keys WHERE code = " . MYSQLMakeString($this->DB, _CreateDBActivationCode($code)) . "
				LIMIT 1;
			");

			if($this->DB->affected_rows === 0)
				return false;

			if($code_data["name"] !== "free")
				return $this->ExtendSubscriptionDuration($account_hash, $code_data["duration"]);

			$subscription_id = $this->CreateSubscription($code_data["subscription_type_id"]);

			if($subscription_id === null)
			{
				$this->InsertActivationCodeRaw(_CreateDBActivationCode($code), $code_data["subscription_type_id"]);
				ExitResponse(ResponseType::ServerError, "failed to create subscription", true);
			}

			if($this->SetAccountSubscriptionID($account_hash, $subscription_id) === false)
			{
				if($this->CreateAccount($account_hash, $subscription_id) === false)
				{
					$this->DeleteTableRowByID("subscriptions", $subscription_id);
					$this->InsertActivationCodeRaw(_CreateDBActivationCode($code), $code_data["subscription_type_id"]);

					ExitResponse(ResponseType::ServerError, "failed to create account on code activate", true);
				}
			}

			return true;
		}

		public function CreateAccount($account_hash, $subscription_id = -1) // get data -> delete code -> create sub. this ensures atomicity
		{
			if($subscription_id === -1)
				$subscription_id = $db->CreateSubscriptionByTypeName("free") ?? ExitRespones(ResponseType::ServerError, );

			$stmt = $this->DB->prepare("
				INSERT INTO accounts (account_hash, subscription_id) VALUES (?, ?);
			");

			$stmt->bind_param("si", $account_hash, $subscription_id);
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
		
		public function FetchAccountData($account_hash)
		{
			$stmt = $this->DB->prepare("
				SELECT subscriptions.expire_date, subscriptions.storage_left, subscription_type.storage as storage_max, subscriptions.subscription_type_id as,  FROM accounts
					INNER JOIN subscriptions ON accounts.subscription_id = subscriptions.id
					INNER JOIN subscription_type ON subscriptions.subscription_type_id = subscription_type.id
				WHERE accounts.account_hash = ?
				LIMIT 1;
			");			
			
			$stmt->bind_param("s", $account_hash);
			$stmt->execute();

			return $stmt->get_result()->fetch_assoc();
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

		public function RegisterFile($account_hash, $data_id, $file_data, $encryption_data, $file_size, $__call_depth = 0) // allocate space with TryReserveSpace ahead of time
		{
			$stmt = $this->DB->prepare("
				INSERT INTO files (account_id, data_id, file_data, encryption_data, finished_writing)
					SELECT id, ?, ?, ?, 0 FROM accounts
						WHERE account_hash = ?;
			");

			$stmt->bind_param("ssssi", $data_id, $file_data, $encryption_data, $account_hash, $file_size);
			$stmt->execute();

			return $this->DB->affected_rows === 1;

			if($this->DB->affected_rows === 0) // if no account exists with given account hash
			{
				if($__call_depth > 0)
					ExitResponse(ResponseType::ServerError, "call depth exceeded in RegisterFile", true);

				$this->CreateAccount($account_hash, 000);
				return $this->RegisterFile($account_hash, $data_id, $file_data, $file_size, $encryption_data, $__call_depth + 1);
			}
			else
				return true;
		}

		public function FinishFileUpload($account_hash, $data_id, $file_data, $encryption_data, $file_size)
		{
			$stmt = $this->DB->prepare("
				UPDATE files
					INNER JOIN accounts ON accounts.account_hash = ?
				SET files.finished_writing = 1
				WHERE files.data_id = ? AND files.file_data = ? AND files.encryption_data = ? AND files.file_size = ?
				LIMIT 1;
			");			
			
			$stmt->bind_param("ssssi", $account_hash, $data_id, $file_data, $encryption_data, $file_size);
			$stmt->execute();

			return $this->DB->affected_rows === 1;
		}

		public function ListFiles($account_hash, $data_id) // remake this to also delete old unfinished files
		{
			$stmt = $this->DB->prepare("
				SELECT files.data_id, files.file_data, files.encryption_data, files.file_size, files.finished_writing FROM files
				INNER JOIN accounts ON accounts.account_hash = ?
				WHERE accounts.id = files.account_id AND files.data.id = ? AND files.finished_writing = 1
			");

			$stmt->bind_param("ss", $account_hash, $data_id);
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

			$this->DeleteUnfinishedFiles($account_hash);

			return $out;
		}
	}
?>