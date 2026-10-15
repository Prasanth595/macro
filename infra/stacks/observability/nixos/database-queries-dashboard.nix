{ lib, pkgs, ... }:
let
  prometheus = {
    type = "prometheus";
    uid = "prometheus";
  };
  loki = {
    type = "loki";
    uid = "loki";
  };
  selector = ''job="integrations/postgres",deployment_environment="dev",db_instance=~"$database",datname="macrodb",queryid=~"$queryid"'';
  logs = ''job="integrations/postgres-queries",deployment_environment="dev",db_instance=~"$database"'';
  panel = id: title: datasource: targets: {
    inherit
      id
      title
      datasource
      targets
      ;
    type = "timeseries";
    gridPos = {
      x = lib.mod (id - 1) 2 * 12;
      y = builtins.div (id - 1) 2 * 9;
      w = 12;
      h = 9;
    };
  };
  metric =
    id: title: expr: unit:
    (panel id title prometheus [
      {
        refId = "A";
        inherit expr;
        legendFormat = "{{db_instance}} {{user}} {{queryid}}";
      }
    ])
    // {
      fieldConfig.defaults = { inherit unit; };
    };
  logPanel =
    id: title: expr:
    (panel id title loki [
      {
        refId = "A";
        inherit expr;
        queryType = "range";
      }
    ])
    // {
      type = "logs";
      options = {
        showTime = true;
        showCommonLabels = false;
        wrapLogMessage = true;
        sortOrder = "Descending";
      };
    };
  dashboard = {
    uid = "macro-postgres-queries";
    title = "Macro PostgreSQL queries";
    schemaVersion = 39;
    version = 1;
    editable = false;
    tags = [
      "macro"
      "postgres"
      "queries"
    ];
    timezone = "browser";
    refresh = "1m";
    time = {
      from = "now-1h";
      to = "now";
    };
    description = "Dev query statistics and sampled activity. Select an instance and query ID, or click a query ID in the top-queries table. The collector retains up to 200 statements per endpoint ranked by cumulative execution time; this is not every execution. Means are not percentiles. SQL is sensitive even when normalized. Activity samples can miss short queries; plans are disabled.";
    links = [
      {
        title = "Database health and collection errors";
        type = "link";
        url = "/d/macro-postgres";
      }
    ];
    templating.list = [
      {
        name = "database";
        label = "Database instance";
        type = "custom";
        query = "macro-db-dev,macro-db-dev-read-replica";
        current = {
          text = "macro-db-dev";
          value = "macro-db-dev";
        };
        options = [ ];
        multi = false;
        includeAll = false;
      }
      {
        name = "queryid";
        label = "Query ID";
        type = "query";
        datasource = prometheus;
        query = ''label_values(pg_stat_statements_calls_total{job="integrations/postgres",deployment_environment="dev",db_instance=~"$database",datname="macrodb"}, queryid)'';
        refresh = 1;
        multi = false;
        includeAll = true;
        allValue = ".*";
        current = {
          text = "All";
          value = "$__all";
        };
        options = [ ];
      }
    ];
    panels = [
      (
        (metric 1 "Top queries by execution time in selected period"
          "topk(20, increase(pg_stat_statements_seconds_total{${selector}}[$__range]))"
          "s"
        )
        // {
          type = "table";
          description = "Database execution seconds across calls, not CPU seconds. Click a query ID to filter this dashboard. New, evicted or reset statement counters can leave gaps.";
          targets = [
            {
              refId = "A";
              expr = "topk(20, increase(pg_stat_statements_seconds_total{${selector}}[$__range]))";
              instant = true;
              format = "table";
            }
          ];
          transformations = [
            {
              id = "organize";
              options = {
                excludeByName = {
                  Time = true;
                  aws_region = true;
                  datname = true;
                  db_instance = true;
                  db_role = true;
                  deployment_environment = true;
                  instance = true;
                  job = true;
                };
                indexByName = {
                  queryid = 0;
                  user = 1;
                  Value = 2;
                };
                renameByName.Value = "Execution time";
              };
            }
          ];
          options.sortBy = [
            {
              displayName = "Execution time";
              desc = true;
            }
          ];
          fieldConfig.overrides = [
            {
              matcher = {
                id = "byName";
                options = "queryid";
              };
              properties = [
                {
                  id = "links";
                  value = [
                    {
                      title = "Investigate query";
                      url = "/d/macro-postgres-queries?var-database=$database&var-queryid=\${__value.raw}&\${__url_time_range}";
                    }
                  ];
                }
              ];
            }
          ];
        }
      )
      (metric 2 "Average execution time per call"
        "1000 * rate(pg_stat_statements_seconds_total{${selector}}[$__rate_interval]) / (rate(pg_stat_statements_calls_total{${selector}}[$__rate_interval]) > 0)"
        "ms"
      )
      (metric 3 "Calls per second" "rate(pg_stat_statements_calls_total{${selector}}[$__rate_interval])"
        "ops"
      )
      (metric 4 "Rows per call"
        "rate(pg_stat_statements_rows_total{${selector}}[$__rate_interval]) / (rate(pg_stat_statements_calls_total{${selector}}[$__rate_interval]) > 0)"
        "short"
      )
      (
        (metric 5 "Block read time per second"
          "rate(pg_stat_statements_block_read_seconds_total{${selector}}[$__rate_interval])"
          "s"
        )
        // {
          description = "Requires track_io_timing on the database; zero can mean timing is disabled. This PR does not change that setting.";
        }
      )
      (metric 6 "Block write time per second"
        "rate(pg_stat_statements_block_write_seconds_total{${selector}}[$__rate_interval])"
        "s"
      )
      (logPanel 7 "Normalized SQL for selected queries"
        ''{${logs},op="query_association"} | logfmt | queryid=~"$queryid" | __error__="" | line_format "{{.queryid}}: {{.querytext}}"''
      )
      (
        (logPanel 8 "Sampled query activity"
          ''{${logs},op="query_sample"} | logfmt | queryid=~"$queryid" | __error__=""''
        )
        // {
          description = "Activity sampled every 15 seconds, emitted when an observed query ends or changes state. Raw SQL is omitted. These records do not represent every execution.";
        }
      )
      (logPanel 9 "Sampled waits and blocking sessions"
        ''{${logs},op="wait_event"} | logfmt | queryid=~"$queryid" | __error__=""''
      )
      (
        (logPanel 10 "Query collector health checks" ''{${logs},op="health_status"}'')
        // {
          description = "Hourly upstream checks, including requirements for features we leave disabled. Also inspect database health: a healthy metric exporter alone does not prove query-detail collection works.";
        }
      )
    ];
  };
in
{
  services.grafana.provision.dashboards.settings.providers = [
    {
      name = "macro-postgres-queries";
      orgId = 1;
      folder = "Macro";
      type = "file";
      disableDeletion = true;
      allowUiUpdates = false;
      options.path = pkgs.linkFarm "macro-postgres-queries-dashboard" [
        {
          name = "postgres-queries.json";
          path = pkgs.writeText "postgres-queries.json" (builtins.toJSON dashboard);
        }
      ];
    }
  ];
}
