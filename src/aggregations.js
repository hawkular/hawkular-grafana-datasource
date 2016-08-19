import _ from "lodash";

export class Aggregations {

  constructor() {}

  on(timeSeries, f) {
    if (timeSeries.length <= 1) {
      return timeSeries;
    }
    // TODO: iterate over timestamps with interpolation when necessary
    // It can be very time-consuming if there's too much data
    // Does hawkular-metrics do it?
    return [timeSeries[0]];
  }

  sum(values) {
    if (values.length === 0) {
      return null;
    }
    return values.reduce((a,b) => a+b);
  }

  average(values) {
    if (values.length === 0) {
      return null;
    }
    return values.reduce((a,b) => a+b) / values.length;
  }

  min(values) {
    if (values.length === 0) {
      return null;
    }
    return values.reduce((a,b) => a<b?a:b);
  }

  max(values) {
    if (values.length === 0) {
      return null;
    }
    return values.reduce((a,b) => a>b?a:b);
  }
}
