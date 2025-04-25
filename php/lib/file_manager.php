<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/utility.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/database.php");

	
	$___name_hash_salt = hex2bin("a2c90fe3dfab12c3799ad5a0b2b7e355");


	function GetManagedFileNameFromHash($hash) // we use this in DeleteUnfinishedFiles
	{
		return $_SERVER["DOCUMENT_ROOT"] . "/../files/" . bin2hex(ByteSubString($hash, 0, 16) ^ ByteSubString($hash, 16));
	}

	function GetManagedFileName($account_hash, $file_id, $fileSizeBuff)
	{
		global $___name_hash_salt;

		return FileDatabase::GetManagedFileNameFromHash(
			hash_hmac("sha256", $file_id . $fileSizeBuff, hash_hmac("sha256", $account_hash, $___name_hash_salt), true)
		);
	}

	class FileHeader
	{
		public $action; // int
		public $finished; // bool
		public $offset; // int
		public $file_size; // int
		//public $upload_date; // int
		public $encryption_data; // string
		public $data_id; // string
		public $file_data; // string

		public function __construct($file_header)
		{
			$file_header_unpacked = unpack("Caction/Cfinished/x6/Poffset/Pfile_size/a104encryption_data/a16data_id/a*file_data", $file_header);
			
			$this->action = $file_header_unpacked["action"];
			$this->finished = $file_header_unpacked["finished"] === 1;
			$this->offset = $file_header_unpacked["offset"];
			$this->file_size = $file_header_unpacked["file_size"];

			//$this->upload_date = $file_header_unpacked["upload_date"];
			$this->encryption_data = $file_header_unpacked["encryption_data"];
			$this->data_id = $file_header_unpacked["data_id"];
			$this->file_data = $file_header_unpacked["file_data"];
		}

		public function DeriveFileName($account_hash)
		{
			return FileDatabase::GetManagedFileName($account_hash, $this->data_id, $this->file_data, $this->encryption_data, $this->file_size);
		}
	}

	class FileDatabase extends Database
	{
		public static function GetManagedFileNameFromHash($hash) // we use this in DeleteUnfinishedFiles
		{
			return $_SERVER["DOCUMENT_ROOT"] . "/../files/" . bin2hex(ByteSubString($hash, 0, 16) ^ ByteSubString($hash, 16));
		}

		public static function GetManagedFileName($account_hash, $data_id, $file_data, $encryption_data, $file_size)
		{
			global $___name_hash_salt;

			return FileDatabase::GetManagedFileNameFromHash(
				hash("sha256", $account_hash . $data_id . $file_data . $encryption_data . $file_size . $___name_hash_salt)
			);
		}

		protected function DeleteUnfinishedFiles($account_hash = null, $data_id = null) // null for either param means itll be disregarded in the WHERE clause
		{
			global $___name_hash_salt;

			$rows = $this->DB->query("
				SELECT 
					files.id,
					SHA2(
						CONCAT(
							accounts.account_hash,
							files.data_id,
							files.file_data,
							files.encryption_data,
							files.file_size,
							" . MYSQLMakeString($this->DB, $___name_hash_salt) . "
						)
					, 256) as full_hash,
					files.file_size
				FROM accounts
				INNER JOIN files ON files.account_id = accounts.id
				WHERE " . ($account_hash !== null ? "accounts.account_hash = " . MYSQLMakeString($this->DB, $account_hash) . " AND " : "") .
				          ($data_id !== null ? "files.data_id = " . MYSQLMakeString($this->DB, $data_id) . " AND " : "") .
						  "files.finished_writing = 0
			")->fetch_all(MYSQLI_ASSOC);

			$rowCount = count($rows);
			for($i = 0; $i < $rowCount; ++$i)
			{
				$file_name = FileDatabase::GetManagedFileNameFromHash($rows[$i]["full_hash"]);

				if(file_exists($file_name))
				{
					$mtime = filemtime($file_name);
					if($mtime === false)
						continue;

					if((time() - $mtime) < 300)
						continue; // still uploading

					if(unlink($file_name) === false)
						continue;
				}

				if($this->DeleteTableRowByID("files", $rows[$i]["id"]) === false)
					continue;
				
				if($this->TryReserveSpace($account_hash, -$rows[$i]["file_size"]) === false) // eventually, in the clean up function, add a check if the file size differs froms the sum of the registered file sizes
					ExitResponse(ResponseType::ServerError, "failed to unreserve space", true);
			}

			return true;
		}
		
		public function ListFiles($account_hash, $data_id)
		{
			$out = Database::ListFiles($account_hash, $data_id);
			foreach ($out as $key => &$value)
			{
				$rowCount = count($out[$key]);
				for($i = 0; $i < $rowCount; ++$i)
				{
					$time = filemtime(FileDatabase::GetManagedFileName(
						$account_hash,
						$out[$key][$i]["data_id"],
						$out[$key][$i]["file_data"],
						$out[$key][$i]["encryption_data"],
						$out[$key][$i]["file_size"]
					));

					if($time !== false)
						$out[$key][$i]["date"] = $time;
				}
			}
			$this->DeleteUnfinishedFiles($account_hash);
			return $out;
		}
	}
?>