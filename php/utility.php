<?php
	function GetHeader($name)
	{
		$headerName = str_replace("-", "_", strtoupper($name));
		if(isset($_SERVER["HTTP_".$headerName]))
		{
			return $_SERVER["HTTP_".$headerName];
		}
		else
		{
			return getallheaders()[implode("-", array_map(function($v)
			{
				$v[0] = strtoupper($v[0]);
				return $v;
			},
			explode("-", strtolower($name))))] ?? null;
		}
	}

	$_valid_origins = [
		"http://localhost:5173" => true // value can be whatever
	];

	function get_cors_origin()
	{
		global $_valid_origins;

		$origin = $_SERVER["HTTP_ORIGIN"];		
		if(isset($_valid_origins[$origin]))
			return $origin;
		
		return false;

		if(isset($_valid_origins[$origin]))
			header("Access-Control-Allow-Origin: " . $origin);
	}

	function handle_cors()
	{
		if(GetHeader("Sec-Fetch-Mode") === "cors")
		{
			$origin = get_cors_origin();
			if($origin)
			{
				header("Access-Control-Allow-Origin: " . $origin);
				header("Access-Control-Max-Age: 7200"); // test not using this
			}
		}

		if($_SERVER["REQUEST_METHOD"] === "OPTIONS") // sometimes the full request is given right away
		{
			ob_clean(); // just incase
			exit();
		}
	}

?>