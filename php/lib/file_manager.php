<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/database_interface.php");

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