import {HawkularDatasource} from './datasource';
import {HawkularDatasourceQueryCtrl} from './query_ctrl';
import {HawkularConfigCtrl} from './config_ctrl';
import {HawkularAnnotationsQueryCtrl} from './annotation_ctrl';

class HawkularQueryOptionsCtrl {}
HawkularQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

export {
  HawkularDatasource as Datasource,
  HawkularDatasourceQueryCtrl as QueryCtrl,
  HawkularConfigCtrl as ConfigCtrl,
  HawkularQueryOptionsCtrl as QueryOptionsCtrl,
  HawkularAnnotationsQueryCtrl as AnnotationsQueryCtrl
};
