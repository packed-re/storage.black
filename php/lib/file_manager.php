<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/database_interface.php");

	$___name_hash_salt = hex2bin("a2c90fe3dfab12c3799ad5a0b2b7e355");

	function GetManagedFileName($account_hash, $data_id, $file_data, $encryption_data, $file_size) // keep this here and change the name of this file
	{
		global $___name_hash_salt;

		$name_hash = hash("sha256", $data_id . $file_data . $encryption_data . $file_size);

		return $_SERVER["DOCUMENT_ROOT"] . "/files/" . hash("sha256", bin2hex(ByteSubString($name_hash, 0, 16) ^ ByteSubString($name_hash, 16)));
	}

	class FileHeader
	{
		public $action; // int
		public $finished; // bool
		public $offset; // int
		public $file_size; // int
		public $encryption_data; // string
		public $data_id; // string
		public $file_data; // string

		public function __construct($file_header)
		{
			$file_header_unpacked = unpack("Caction/Cfinished/x6/Qoffset/Qfile_size/a104encryption_data/a16data_id/a*file_data");
			
			$this->action = $file_header_unpacked["action"];
			$this->finished = $file_header_unpacked["finished"] === 1;
			$this->offset = $file_header_unpacked["offset"];
			$this->file_size = $file_header_unpacked["file_size"];

			$this->encryption_data = $file_header_unpacked["encryption_data"];
			$this->data_id = $file_header_unpacked["data_id"];
			$this->file_data = $file_header_unpacked["file_data"];
		}

		public function DeriveFileName($account_hash)
		{
			return GetManagedFileName($account_hash, $this->data_id, $this->file_data, $this->encryption_data, $this->file_size);
		}
	}
?>