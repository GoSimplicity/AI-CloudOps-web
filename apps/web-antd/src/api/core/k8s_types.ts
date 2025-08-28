export interface ContainerPort {
  name?: string;
  container_port: number;
  protocol?: string;
  host_port?: number;
}

export interface EnvVar {
  name: string;
  value?: string;
  value_from?: EnvVarSource;
}

export interface EnvVarSource {
  field_ref?: ObjectFieldSelector;
  resource_field_ref?: ResourceFieldSelector;
  config_map_key_ref?: ConfigMapKeySelector;
  secret_key_ref?: SecretKeySelector;
}

export interface ObjectFieldSelector {
  field_path: string;
}

export interface ResourceFieldSelector {
  container_name?: string;
  resource: string;
}

export interface ConfigMapKeySelector {
  name: string;
  key: string;
  optional?: boolean;
}

export interface SecretKeySelector {
  name: string;
  key: string;
  optional?: boolean;
}

export interface ResourceRequirements {
  limits?: Record<string, string>;
  requests?: Record<string, string>;
}

export interface VolumeMount {
  name: string;
  mount_path: string;
  read_only?: boolean;
  sub_path?: string;
}

export interface Probe {
  http_get?: HTTPGetAction;
  tcp_socket?: TCPSocketAction;
  exec?: ExecAction;
  initial_delay_seconds?: number;
  period_seconds?: number;
  timeout_seconds?: number;
  success_threshold?: number;
  failure_threshold?: number;
}

export interface HTTPGetAction {
  path?: string;
  port: number | string;
  scheme?: string;
  http_headers?: HTTPHeader[];
}

export interface HTTPHeader {
  name: string;
  value: string;
}

export interface TCPSocketAction {
  port: number | string;
}

export interface ExecAction {
  command?: string[];
}

export interface Toleration {
  key?: string;
  operator?: string;
  value?: string;
  effect?: string;
  toleration_seconds?: number;
}

export interface ServicePort {
  name?: string;
  protocol: string;
  port: number;
  target_port?: number | string;
  node_port?: number;
}
