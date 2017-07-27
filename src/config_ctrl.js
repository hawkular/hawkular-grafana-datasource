export class HawkularConfigCtrl {

  constructor() {
    this.current.url = this.current.url || 'http://your_server:8080/hawkular/metrics'
  }
}

HawkularConfigCtrl.templateUrl = 'partials/config.html';
