<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/crypto.php");
	//require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");

	$___master_key = hash("sha256", hex2bin("47d2eebb1a90cd2980c51bec19981b82fb2af20e4b8cbe4159ed6dbb148da834") . $_SERVER["REMOTE_ADDR"], true);

	class Session
	{
		public $expire_date;
		public $rand_long;
		public $account_id;

		protected function __construct($expire_date, $rand_long, $account_id)
		{
			$this->expire_date = $expire_date;
			$this->rand_long = $rand_long;
			$this->account_id = $account_id;
		}

		static public function Make($age, $account_id)
		{
			return new Session(time() + $age, random_bytes(8), $account_id);
		}

		public function DeriveEncryptionKey()
		{
			return hash_hmac("sha256", $this->account_id . $_SERVER["REMOTE_ADDR"], $this->rand_long, true);
		}

		public function ToToken()
		{
			global $___master_key;
	
			return BasicEncrypt(pack("Qa8a32", $this->expire_date, $this->rand_long, $this->account_id), $___master_key, OPENSSL_ZERO_PADDING);
		}

		static public function FromToken($token)
		{
			global $___master_key;

			$data = BasicDecrypt($token, $___master_key, OPENSSL_ZERO_PADDING);
			if($data === false)
				return false;
			
			$unpacked_data = unpack("Qexpire_date/a8rand_long/a32account_id", $data);

			if($unpacked_data["expire_date"] <= time())
				return false;
			
			return new Session($unpacked_data["expire_date"], $unpacked_data["rand_long"], $unpacked_data["account_id"]);
		}
	}
?>