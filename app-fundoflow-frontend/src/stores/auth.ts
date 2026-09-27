import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { tenantRepo } from "../db/tenant-repo";
import type { Tenant } from "../types";

const ACTIVE_TENANT_KEY = "fundoflow.active_tenant";

export const useAuthStore = defineStore("auth", () => {
  const tenants = ref<Tenant[]>([]);
  const activeTenantId = ref<string | null>(localStorage.getItem(ACTIVE_TENANT_KEY));
  const supervisorName = ref<string>(
    localStorage.getItem("fundoflow.supervisor_name") ?? "Juan",
  );

  function loadTenants() {
    tenants.value = tenantRepo.list();
  }

  function setActiveTenant(id: string) {
    activeTenantId.value = id;
    localStorage.setItem(ACTIVE_TENANT_KEY, id);
  }

  function setSupervisorName(name: string) {
    supervisorName.value = name;
    localStorage.setItem("fundoflow.supervisor_name", name);
  }

  const activeTenant = computed<Tenant | null>(() =>
    activeTenantId.value ? tenantRepo.get(activeTenantId.value) : null,
  );

  return {
    tenants,
    activeTenantId,
    activeTenant,
    supervisorName,
    loadTenants,
    setActiveTenant,
    setSupervisorName,
  };
});
