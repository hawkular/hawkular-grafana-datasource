export class HawkularConfigCtrl {

  constructor() {
    this.current.url = this.current.url || 'http://your_server:8080/hawkular'
  }
}

HawkularConfigCtrl.templateUrl = 'partials/config.html';
