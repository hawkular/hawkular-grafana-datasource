'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var HawkularConfigCtrl = exports.HawkularConfigCtrl = function HawkularConfigCtrl() {
  _classCallCheck(this, HawkularConfigCtrl);

  this.current.url = this.current.url || 'http://your_server:8080/hawkular';
};

HawkularConfigCtrl.templateUrl = 'partials/config.html';
//# sourceMappingURL=config_ctrl.js.map
