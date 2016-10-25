export class Capabilities {

  constructor(versionStr) {
    this.QUERY_POST_ENDPOINTS = true;
    this.QUERY_BY_TAGS = true;
    this.QUERY_STATS_POST_ENDPOINTS = true;
    let regExp = new RegExp('([0-9]+)\.([0-9]+)\.(.+)');
    if (versionStr.match(regExp)) {
      let versionInfo = regExp.exec(versionStr);
      let major = versionInfo[1];
      let minor = versionInfo[2];
      if (major == 0 && minor < 17) {
        this.QUERY_POST_ENDPOINTS = false;
      }
      if (major == 0 && minor < 20) {
        this.QUERY_STATS_POST_ENDPOINTS = false;
        this.QUERY_BY_TAGS = false;
      }
    }
  }
}
