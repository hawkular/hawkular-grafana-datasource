import {HawkularDatasource} from './datasource';
import {HawkularDatasourceQueryCtrl} from './query_ctrl';

class HawkularConfigCtrl {}
HawkularConfigCtrl.templateUrl = 'partials/config.html';

class HawkularQueryOptionsCtrl {}
HawkularQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

class HawkularAnnotationsQueryCtrl {}
HawkularAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';

export {
  HawkularDatasource as Datasource,
  HawkularDatasourceQueryCtrl as QueryCtrl,
  HawkularConfigCtrl as ConfigCtrl,
  HawkularQueryOptionsCtrl as QueryOptionsCtrl,
  HawkularAnnotationsQueryCtrl as AnnotationsQueryCtrl
};
