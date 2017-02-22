export class Capabilities {

  constructor(versionStr) {
    this.QUERY_POST_ENDPOINTS = true;
    this.QUERY_BY_TAGS = true;
    this.QUERY_STATS_POST_ENDPOINTS = true;
    this.FETCH_ALL_TAGS = true;
    this.TAGS_QUERY_LANGUAGE = true;
    const regExp = new RegExp('([0-9]+)\.([0-9]+)\.(.+)');
    if (versionStr.match(regExp)) {
      const versionInfo = regExp.exec(versionStr);
      const major = +versionInfo[1];
      const minor = +versionInfo[2];
      if (major === 0 && minor < 17) {
        this.QUERY_POST_ENDPOINTS = false;
      }
      if (major === 0 && minor < 20) {
        this.QUERY_STATS_POST_ENDPOINTS = false;
        this.QUERY_BY_TAGS = false;
      }
      if (major === 0 && minor < 22) {
        this.FETCH_ALL_TAGS = false;
      }
      if (major === 0 && minor < 24) {
        this.TAGS_QUERY_LANGUAGE = false;
      }
    }
  }
}
