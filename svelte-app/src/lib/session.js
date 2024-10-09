class Session
{
	FetchAccountSettings()
	{

	}

	static FromBaseKey(base_key)
	{
		// fetch session key in here
	}

	static FromLocalStorage() // If there is no active or valid session, return false. If false all site data is cleared.
	{

	}
}

// l storage
// encr(id)
// encr(encr_k)
// session_data

// cookies
// extra encryption key