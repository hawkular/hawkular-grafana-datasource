# Hawkular Datasource for Grafana

This project is the Hawkular Datasource plugin for Grafana. It works with:

* Hawkular Metrics (standalone)
* Hawkular Services, starting from version Alpha13
* OpenShift with Hawkular Metrics

## Configuration

The datasource URL must point to the Hawkular server, e.g. `http://myhost:8080/hawkular` (without ending `/metrics`)

Access: both `proxy` and `direct` modes should work in most configurations. Some earlier versions of Hawkular Metrics had a bug with CORS headers, that prevented the use of `direct` mode here.
If you want to use `direct` mode (that is, direct calls from client browser to Hawkular REST API), and if you have setup CORS restrictions in Hawkular, make sure to allow the Grafana server origin in Metrics' configuration.
If you're unsure, just use `proxy` mode and you should be fine.

Authentication must be set when working with a Hawkular server. Check the 'Basic Auth' box and fill the user and password fields.

Select the tenant. On Hawkular servers, use `hawkular`.

Openshift-Metrics users must provide an authentication token.

Note that if you configure both Basic Authentication and a Token, only Basic Authentication will be effective.

## Usage

### Queries

When adding a Graph panel, the Metrics tab allows you fetch _Gauges_, _Counters_ and _Availability_ metrics in Hawkular. You can search by metric name and/or tag, assuming your version of hawkular-metrics is at least 0.20.0. Prior versions only allow searching by name.

> To know your version of hawkular-metrics, check the _status_ endpoint. E.g. `http://myhost:8080/hawkular/metrics/status`

Since 0.24.0, hawkular-metrics offers a _"tags query language"_ that allows more accurate queries on tags. If you query with tags and leave the metric name empty, the graph will display all matching metrics:

![Tags query language](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/unified-search-tags.png)

Tags queries are also useful to refine the metric name suggestions (auto-completion), to facilitate usage when Hawkular contains a lot of metrics:

![Refining auto-completion](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/unified-search-name.png)

To remove a tag expression, click on the tag name and select "Remove tag".

A full text editor is available, to use Hawkular's tag query language:

![Tags full text mode](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/unified-search-tags-edit-mode.png)

> When used with hawkular-metrics prior to 0.24.0, tags are still available but the UI switches to the old key-value pairs system.


When using a _Singlestat_ panel, some additional options come in. The Hawkular Datasource plugin can perform aggregations on multiple metrics, which usually the _Singlestat_ panel doesn't. It's actually a two-steps aggregation: first, multiple series are reduced into a single one (that is either the sum of its parts, or the average). Then, the resulting series is aggregated over time through another folding: min, max, average etc.

![Example of singlestat panel](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/single-stats-aggreg.png)

> Note that because the aggregation takes place in Hawkular, the _Singlestat_ panel has nothing to aggregate. Thus in panel options, setting whatever in the _value_ field on the _Big value_ won't have any effect. However if you don't want to use the Hawkular aggregation, just set _Multiple series aggregation_ to _None_.

### Templating variables

Grafana allows you to create dashboard templates through the definition of variables.
This is [documented on Grafana's site](http://docs.grafana.org/reference/templating/).
With the Hawkular Datasource Plugin, the variables of type _'Query'_ are mapped to
the [_@get (url)/metrics_](http://www.hawkular.org/docs/rest/rest-metrics.html#GET__metrics)
Hawkular Metrics endpoint and can be used to retrieve tenant's metric names. Use the _Query Options_ text field to pass query parameters, as illustrated below:

Example of query by tags to get metric ids
![Example of query by tags to get metric ids](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/query-for-metrics.png)

> For instance, if you have metrics tagged _"type:memory"_ and others tagged _"type:cpu"_, you can write _"tags=type:memory"_ to get only the _"memory"_ ones, or _"tags=type:cpu|memory"_ to get them both.

There is an exception to that rule: if the query string is prefixed with _'tags/'_, the variable will contain the matching
tag names rather than the metric names. In this case, the Hawkular Metrics endpoint [_@get (url)/metrics/tags/{tags}_](http://www.hawkular.org/docs/rest/rest-metrics.html#GET__metrics_tags__tags) will be used.

Example of query to get matching tag values
![example to get matching tag values](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/query-for-tags.png)

> For instance, type _"tags/type:*"_ to get all of the available tag values for _"type"_.

Once you have set some variables, you can use them in graph queries by inserting the variable name prefixed with a _$_. It can be used either for row or graph duplication, or to display multiple series in a single graph from a single query. This is especially useful when metric names contain some dynamic parts and thus cannot be known in advance.

They can also be used in tag values, after operators _=_ / _!=_ / _is in_ / _is not in_.

### Annotations

Annotations are available through the use of _'string'_ and _'availability'_ metrics in Hawkular, or _'events'_ from Hawkular Alerts. It's a Grafana feature that allows to display custom events in timed charts.

Example with a _'string'_ metric:

1. Setup an annotation query in Grafana. In _'Query'_, put the name of a _'string'_ metric you want to use to gather these annotations.

![Annotation setup](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/annotation-setup.png)

2. Post any event (ie. string + timestamp) to some string metric.

Example, JSON posted on [the Hawkular's REST API](http://www.hawkular.org/hawkular-metrics/docs/user-guide/#_inserting_data) to `/strings/my.timeline.metric/raw`:

```json
  [
    {"timestamp": 1485352477824, "value": "Starting my scenario..."}
  ]
```

3. Check your charts:

![Annotation in chart](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/annotation.png)

In the case of Hawkular Alerts events, you need to provide the trigger ID (several comma-separated IDs are allowed).

## Installing from sources

Additional information on installing from sources can be found on [hawkular.org](http://www.hawkular.org/hawkular-clients/grafana/docs/quickstart-guide/).

## Troubleshooting

### Grafana fails to establish a connection or get data from hawkular

* Check the URL: `[host]/hawkular`. Make sure there's no ending slash. When you open up this URL in a browser you should see the Hawkular logo, the installed version and a mention that the service is started.

* Make sure the credentials or token match your installation. In general, if you installed a **standalone hawkular-metrics** server without any specific configuration you probably don't have any authentication information to provide. If you installed **hawkular-services** using its [installation guide](http://www.hawkular.org/hawkular-services/docs/installation-guide/) you will probably have to fill-in the basic auth fields. If you are using **Hawkular from OpenShift**, you have to provide a Bearer token in the `Token` field. Tokens can be [generated temporarily](https://docs.openshift.com/enterprise/3.1/architecture/additional_concepts/authentication.html) (go to `[OpenShift host]/oauth/token/request`) or from a [Service account](https://docs.openshift.com/container-platform/3.3/rest_api/index.html#rest-api-serviceaccount-tokens) in OpenShift.

* Check the javascript debugging tool of your browser. If you see an error mentioning issues with CORS, switch to `proxy` mode in the datasource configuration.

### I can't query by tag, the option is not displayed

Querying by tag was introduced before the plugin was properly versioned, so if you have a version >= 1.0.2 you should have it. However it is only enabled when Grafana talks to hawkular-metrics >= 0.20.0. To check your version of hawkular-metrics just open its status page in a browser (`[host]/hawkular/metrics` or `[host]/hawkular/metrics/status`).

### Connection is OK but I can't get any metric

Make sure the tenant you've configured is exactly the same than the one used to insert data. Beware that it is case sensitive. If you have any doubt about the actual presence of data in Hawkular, you can confirm with a `curl` command, for instance:

```bash
curl -u myUsername:myPassword \
  -X GET "http://myserver/hawkular/metrics/gauges/mymetric/raw" \
  -H "Content-Type: application/json" -H "Hawkular-Tenant: myTenant"`
```

More about the REST API: http://www.hawkular.org/docs/rest/rest-metrics.html

Also note that in Hawkular, data has a retention period of 7 days by default ([it can be configured](http://www.hawkular.org/hawkular-metrics/docs/user-guide/#_data_retention_and_removal)). So if no data has been produced since that time, you won't be able to see anything.

### I'm running Hawkular in OpenShift, connection is OK but I can't get any metric

Check your version of hawkular-metrics (`[host]/hawkular/metrics` or `[host]/hawkular/metrics/status`). Prior to 0.16.0, metric names containing slashes, like in OpenShift, were unfortunately not showing up in Grafana. You can consider [upgrading metrics](https://docs.openshift.org/latest/install_config/upgrading/manual_upgrades.html#manual-upgrading-cluster-metrics).
