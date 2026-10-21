import { storageServiceClient } from '@service-storage/client';
import {
  fetchCrmContactPreviews as fetchContacts,
  fetchCrmDealPreviews as fetchDeals,
  fetchCrmPipelinePreviews as fetchPipelines,
  fetchCrmCompanyPreviews as fetchPreviews,
} from './queries/previews';
export function fetchCrmCompanyPreviews(ids: string[]) {
  return fetchPreviews((input) => storageServiceClient.getCompany(input), ids);
}

export function fetchCrmContactPreviews(ids: string[]) {
  return fetchContacts((input) => storageServiceClient.getContact(input), ids);
}

export function fetchCrmDealPreviews(ids: string[]) {
  return fetchDeals((input) => storageServiceClient.getDeal(input), ids);
}

export function fetchCrmPipelinePreviews(ids: string[]) {
  return fetchPipelines((id) => storageServiceClient.getCrmPipeline(id), ids);
}
