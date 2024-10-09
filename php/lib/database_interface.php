<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");

	function GetFileName($account_hash, $data_id, $file_data, $file_size)
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
	}
?>