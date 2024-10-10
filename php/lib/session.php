<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/crypto.php");

	$___master_key = hash("sha256", hex2bin("47d2eebb1a90cd2980c51bec19981b82fb2af20e4b8cbe4159ed6dbb148da834") . $_SERVER["REMOTE_ADDR"], true);

	class Session
	{
		public $encryption_key;
		public $expire_date; // timestamp after which the session is no longer valid

		protected function __construct($encryption_key, $expire_date) // use this to create a new session
		{
			$this->encryption_key = $encryption_key;
			$this->expire_date = $expire_date;
		}

		static public function Make($age)
		{
			return new Session(GenerateKey(), time() + $age);
		}

		public function ToToken()
		{
			global $___master_key;
	
			return BasicEncrypt(pack("a32Q", $this->encryption_key, $this->expire_date), $___master_key);
		}

		static public function FromToken($token)
		{
			global $___master_key;
	
			$data = BasicDecrypt($token, $___master_key);
			if($data === false)
				return false;
			
			$unpacked_data = unpack("a32encryption_key/Qexpire_date", $data);

			if($unpacked_data["expire_date"] <= time())
				return false;
			
			return new Session($unpacked_data["encryption_key"], $unpacked_data["expire_date"]);
		}
	}
?>