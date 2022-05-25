///////////////////////////////////////////////////////////////////////////////
// BACKGROUND.JS
///////////////////////////////////////////////////////////////////////////////

/**
 * Get Slack Authorization URL
 * see: https://api.slack.com/authentication/oauth-v2#asking
 * @param {*} clientID 
 * @param {*} redirectURL 
 * @returns Authorization URL
 */
// TODO: pass in 'state'
const getAuthURLSlack = ({ clientID, redirectURL }) => {
  const scopes = ["channels:join","channels:read","groups:read","chat:write","files:write"];
  const user_scopes = ["identity.basic"];
  let url = "https://slack.com/oauth/v2/authorize";
  url += `?scope=${encodeURIComponent(scopes.join(','))}`;
  url += `&user_scope=${encodeURIComponent(user_scopes.join(','))}`;
  url += `&client_id=${clientID}`;
  url += `&redirect_uri=${encodeURIComponent(redirectURL)}`;
  url += `&state=TY2OTZhZGFk`;
  // NOTE: response_type=token (implicit grant) NOT supported
  url += `&response_type=code`;
  url += `&prompt=consent`;
  url += `&access_type=offline`;
  //console.log("url", url);
  // TODO: 'team' parameter
  // see: https://api.slack.com/authentication/oauth-v2#asking__how-the-team-parameter-behaves
  return url;
};

/**
 * Handle Slack Authorization Callback
 * see: https://api.slack.com/authentication/oauth-v2#exchanging
 * @param {*} clientID 
 * @param {*} redirectURL 
 * @param {*} responseURL 
 * @returns Slack Access Token, User Token
 */
const handleCallbackSlack = async({ clientID, redirectURL, responseURL }) => {
  // TODO: get from settings
  const clientSecret = "redacted";
  let code = null;
  let accessToken = null;
  //console.log(`responseURL: ${responseURL}`);
  const url = new URL(responseURL);
  //console.log("url:", url);
  //const protocol = url.protocol; //(http:)
  //const hostname = url.hostname; //(www.example.com)
  const pathname = url.pathname; //(/some/path)
  //console.log("pathname:", pathname);
  const search = url.search; // (?name=value)
  if (search) {
    let parts = [];
    search?.substring(1,search?.length)?.split("&")?.forEach(function(part) {
      const item = part?.split("=");
      parts[item[0]] = decodeURIComponent(item[1]);
    });
    //console.log("search:", search);
    //console.log("searchParts:", parts);
    code = parts["code"];
    //console.log("code:", code);
  };
  const hash = url.hash; //(#anchor)
  if (hash) {
    let parts = [];
    hash?.substring(1,hash?.length)?.split("&")?.forEach(part => {
      const item = part?.split("=");
      parts[item[0]] = decodeURIComponent(item[1]);
    });
    //console.log("hashParts:", parts);
    accessToken = parts["access_token"];
    //console.log("accessToken:", accessToken);
  };
  // TODO: validate state param
  // TODO: separate method?
  if (code) {
    try {
      var form = new FormData();
      form.append('client_id', clientID)
      form.append('client_secret', clientSecret);
      form.append('code', code);
      form.append('grant_type', 'authorization_code');
      form.append('redirect_uri', redirectURL);
      const res = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        body: form
      });
      const data = await res.json();
      //console.log("data:", data);
      accessToken = data?.["access_token"];
      //console.log("accessToken:", accessToken);
    } catch(error) {
      console.error(error);
    };
  };
  return accessToken;
};

///////////////////////////////////////////////////////////////////////////////
// INTERNAL, PRIVATE METHODS 
///////////////////////////////////////////////////////////////////////////////

const _listChannels = async({ accessToken }) => {
  const url = "https://slack.com/api/conversations.list";
  return fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ accessToken }`,
    }
  });
};

// TODO: support available export formats (beyond webm)
const _uploadFile = async({ accessToken, itemID, filename, blobs }) => {
  const url = "https://slack.com/api/files.upload";
  const metadata = {
    name: filename,
    mimeType: 'video/webm'
  };
  const superBuffer = new Blob(blobs, {
    type: 'video/webm'
  });
  var form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
  form.append('channels', itemID)
  form.append('file', superBuffer, filename);
  return fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ accessToken }`,
    },
    body: form
  });
};

// TODO: need to use User Token (rather than Access/Bot Token)
// https://api.slack.com/authentication/token-types#user
const _getIdentity = async({ accessToken }) => {
  if (!accessToken) {
    console.error("ERROR: Missing Access Token!");
    return null;
  };
  try {
    const url = "https://slack.com/api/users.identity";
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ accessToken }`,
      }
    });
    const data = await res.json();
    console.log("data:", data);
    const displayName = data?.user?.name;
    return displayName;
  } catch(error) {
    console.error(error);
    return null;
  };
};

// TODO: move to utils/
//const _getTimestamp = () => new Date().toISOString().replace(/(\.\d{3})|[^\d]/g,'');

///////////////////////////////////////////////////////////////////////////////
// CONTENT - VIDEOEDITOR.JS
///////////////////////////////////////////////////////////////////////////////

/**
 * Upload video to Slack 
 * @param {*} accessToken 
 * @param {*} itemID 
 * @param {*} blobs 
 * @returns Upload response metadata
 */
const uploadSlack = async({ accessToken, itemID, blobs }) => {
  if (!accessToken) {
    console.error("ERROR: Missing Access Token!");
    return null;
  };
  if (!itemID) {
    console.error("ERROR: Missing Item ID!");
    return null;
  };
  if (!blobs) {
    console.error("ERROR: Missing Video Blob(s)!");
    return null;
  };
  let filename = null;
  const displayName = null;
  //const displayName = await _getIdentity({ accessToken });
  //if (!displayName) {
  //  console.error("ERROR: Missing Display Name!");
  //  return null;
  //};
  const timestamp = _getTimestamp();
  filename = displayName ? `${displayName.replace(' ','')}${timestamp}` : timestamp;
  //console.log("filename:", filename);
  const res = await _uploadFile({ accessToken, itemID, filename, blobs });
  return res.json();
};

/**
 * List available Slack Channels 
 * @param {*} accessToken 
 * @returns List of options (ie, Slack Channels)
 */
const listSlack = async({ accessToken }) => {
  if (!accessToken) {
    console.error("ERROR: Missing Access Token!");
    return null;
  };
  const res = await _listChannels({ accessToken });
  const data = await res.json();
  //console.log("data:", data);
  const options = data?.channels?.map(channel => {
    let name = channel?.name;
    if (name?.length > 35) name = name.substring(0, 35) + "...";
    return {
      key: channel?.id,
      value: name,
      label: name,
    };
  });
  //console.log("options:", options);
  return options;
};