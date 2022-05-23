///////////////////////////////////////////////////////////////////////////////
// BACKGROUND.JS
///////////////////////////////////////////////////////////////////////////////

/**
 * Get JIRA Authorization URL
 * see: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#1--direct-the-user-to-the-authorization-url-to-get-an-authorization-code
 * @param {*} clientID 
 * @param {*} redirectURL 
 * @returns Authorization URL
 */
// TODO: pass in 'state'
const getAuthURLJira = ({ clientID, redirectURL }) => {
  const scopes = ["read:jira-user","read:jira-work","write:jira-work"];
  let url = "https://auth.atlassian.com/authorize";
  url += "?audience=api.atlassian.com";
  url += `&client_id=${clientID}`;
  url += `&scope=${encodeURIComponent(scopes.join(' '))}`;
  url += `&redirect_uri=${encodeURIComponent(redirectURL)}`;
  url += `&state=TY2OTZhZGFk`;
  // NOTE: response_type=token (implicit grant) NOT supported
  url += `&response_type=code`;
  url += `&prompt=consent`;
  url += `&access_type=offline`;
  //console.log("url", url);
  return url;
};

/**
 * Handle JIRA Authorization Callback
 * see: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#2--exchange-authorization-code-for-access-token
 * @param {*} clientID 
 * @param {*} redirectURL 
 * @param {*} responseURL 
 * @returns JIRA Access Token
 */
const handleCallbackJira = async({ clientID, redirectURL, responseURL }) => {
  // TODO: get from settings
  const clientSecret = "redacted"
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
  // TODO: separate method?
  if (code) {
    const res = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientID, 
        client_secret: clientSecret,
        code,
        redirect_uri: redirectURL,
      })
    });
    const data = await res.json();
    //console.log("data:", data);
    accessToken = data?.["access_token"];
    //console.log("accessToken:", accessToken);
  };
  return accessToken;
};

///////////////////////////////////////////////////////////////////////////////
// INTERNAL, PRIVATE METHODS 
///////////////////////////////////////////////////////////////////////////////

const _getCloudID = async({ accessToken }) => {
  const url = "https://api.atlassian.com/oauth/token/accessible-resources";
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ accessToken }`,
    }
  });
  const data = await res.json();
  //console.log("data:", data);
  const cloudID = data?.[0]?.id;
  return cloudID;
};

// TODO: auto-paginate
const _listIssues = async({ cloudID, accessToken }) => {
  const url = `https://api.atlassian.com/ex/jira/${cloudID}/rest/api/3/search?maxResults=10000000`;
  return fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ accessToken }`,
    }
  });
};

// TODO: support available export formats (beyond webm)
const _uploadAttachment = async({ cloudID, accessToken, itemID, filename, blobs }) => {
  const url = `https://api.atlassian.com/ex/jira/${cloudID}/rest/api/2/issue/${itemID}/attachments`;
  const metadata = {
    name: filename,
    mimeType: 'video/webm'
  };
  const superBuffer = new Blob(blobs, {
    type: 'video/webm'
  });
  var form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
  form.append('file', superBuffer, filename);
  return fetch(url, {
    method: "POST",
    headers: {
      "X-Atlassian-Token": "no-check",
      "Authorization": `Bearer ${ accessToken }`,
    },
    body: form
  });
};

const _getMyUser = async({ accessToken }) => {
  if (!accessToken) {
    console.error("ERROR: Missing Access Token!");
    return null;
  };
  const cloudID = await _getCloudID({ accessToken });
  //console.log("cloudID:", cloudID);
  if (cloudID) {
    const url = `https://api.atlassian.com/ex/jira/${cloudID}/rest/api/3/myself`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ accessToken }`,
      }
    });
    const data = await res.json();
    //console.log("data:", data);
    const displayName = data?.displayName;
    return displayName;
  } else {
    console.error("ERROR: Missing Cloud ID!");
    return null;
  };
};

const _getTimestamp = () => new Date().toISOString().replace(/(\.\d{3})|[^\d]/g,'');

///////////////////////////////////////////////////////////////////////////////
// CONTENT - VIDEOEDITOR.JS
///////////////////////////////////////////////////////////////////////////////

/**
 * Upload video to JIRA
 * @param {*} accessToken 
 * @param {*} itemID 
 * @param {*} blobs 
 * @returns Upload response metadata
 */
const uploadJira = async({ accessToken, itemID, blobs }) => {
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
  const cloudID = await _getCloudID({ accessToken });
  //console.log("cloudID:", cloudID);
  if (cloudID) {
    let filename = null;
    const displayName = await _getMyUser({ cloudID, accessToken });
    if (!displayName) {
      console.error("ERROR: Missing Display Name!");
      return null;
    };
    const timestamp = _getTimestamp();
    filename = displayName ? `${displayName.replace(' ','')}${timestamp}` : timestamp;
    //console.log("filename:", filename);
    const res = await _uploadAttachment({ cloudID, accessToken, itemID, filename, blobs });
    return res.json();
  } else {
    console.error("ERROR: Missing Cloud ID!");
    return null;
  };
};

/**
 * List available JIRA Issues
 * @param {*} accessToken 
 * @returns List of options (ie, JIRA Issues)
 */
const listJira = async({ accessToken }) => {
  if (!accessToken) {
    console.error("ERROR: Missing Access Token!");
    return null;
  };
  const cloudID = await _getCloudID({ accessToken });
  //console.log("cloudID:", cloudID);
  if (cloudID) {
    const res = await _listIssues({ cloudID, accessToken });
    const data = await res.json();
    const options = data?.issues?.map(issue => {
      let summary = issue.fields?.summary;
      if (summary?.length > 35) summary = summary.substring(0, 35) + "...";
      return {
        key: issue.id,
        value: issue.key,
        label: summary,
      };
    });
    //console.log("options:", options);
    return options;
  } else {
    console.error("ERROR: Missing Cloud ID!");
    return null;
  };
};