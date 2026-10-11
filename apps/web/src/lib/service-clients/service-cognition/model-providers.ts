import { SERVER_HOSTS } from '@core/constant/servers';
import { fetchWithToken } from '@core/util/fetchWithToken';
import { throwOnErr } from '@core/util/result';

export type ProviderModel = {
  id: string;
  name: string;
  supports_images: boolean;
};
export type WorkspaceProvider = {
  id: string;
  name: string;
  base_url: string;
  has_api_key: boolean;
  enabled: boolean;
  models: ProviderModel[];
};
export type ProviderInput = Omit<WorkspaceProvider, 'has_api_key'> & {
  api_key?: string;
  clear_api_key?: boolean;
};
export type ProviderSettings = {
  revision: number;
  can_edit: boolean;
  providers: WorkspaceProvider[];
  default_model: string | null;
};
export type ProviderSettingsInput = {
  revision: number;
  providers: ProviderInput[];
  default_model: string | null;
};
export type WorkspaceModel = {
  id: `workspace-${string}/${string}`;
  name: string;
  provider: string;
  supports_images: boolean;
};
export type WorkspaceModelCatalog = {
  models: WorkspaceModel[];
  default_model: WorkspaceModel['id'] | null;
};
const host = SERVER_HOSTS['cognition-service'];
const scope = (teamId?: string) =>
  teamId ? `?team_id=${encodeURIComponent(teamId)}` : '';
export const modelProviderClient = {
  settings: (teamId?: string) =>
    throwOnErr(() =>
      fetchWithToken<ProviderSettings>(`${host}/ai/providers${scope(teamId)}`)
    ),
  save: (input: ProviderSettingsInput, teamId?: string) =>
    throwOnErr(() =>
      fetchWithToken<ProviderSettings>(`${host}/ai/providers${scope(teamId)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      })
    ),
  discover: (input: ProviderInput, teamId?: string) =>
    throwOnErr(() =>
      fetchWithToken<{ models: ProviderModel[] }>(
        `${host}/ai/providers/discover${scope(teamId)}`,
        { method: 'POST', body: JSON.stringify(input) }
      )
    ),
  catalog: () =>
    throwOnErr(() =>
      fetchWithToken<WorkspaceModelCatalog>(`${host}/ai/models`)
    ),
};
