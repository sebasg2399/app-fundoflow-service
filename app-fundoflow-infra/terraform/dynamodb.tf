###############################################################################
# Tenants — cada fundo agrícola (tenant lógico).
# PK: id (uuid). Multi-tenancy por tenant_id en el resto de tablas (GSIs).
###############################################################################
resource "aws_dynamodb_table" "tenants" {
  name         = "${local.name_prefix}-tenants"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = local.common_tags
}

###############################################################################
# Workers — personal de campo por tenant.
# PK: id (uuid, generado en cliente para offline-first).
# GSI tenant_id-index: lookup por tenant.
# GSI tenant_id-updated_at-index: pull de cambios desde last_sync_timestamp.
###############################################################################
resource "aws_dynamodb_table" "workers" {
  name         = "${local.name_prefix}-workers"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "updated_at"
    type = "S"
  }

  global_secondary_index {
    name            = "tenant_id-index"
    hash_key        = "tenant_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "tenant_id-updated_at-index"
    hash_key        = "tenant_id"
    range_key       = "updated_at"
    projection_type = "ALL"
  }

  tags = local.common_tags
}

###############################################################################
# Harvest logs — registro transaccional inmutable del trabajo a destajo.
# PK: id (uuid, generado en cliente).
# GSI tenant_id-scanned_at-index: consultas por día para Stripe metered billing.
# GSI worker_id-scanned_at-index: consultas por trabajador.
###############################################################################
resource "aws_dynamodb_table" "harvest_logs" {
  name         = "${local.name_prefix}-harvest_logs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "scanned_at"
    type = "S"
  }

  attribute {
    name = "worker_id"
    type = "S"
  }

  global_secondary_index {
    name            = "tenant_id-scanned_at-index"
    hash_key        = "tenant_id"
    range_key       = "scanned_at"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "worker_id-scanned_at-index"
    hash_key        = "worker_id"
    range_key       = "scanned_at"
    projection_type = "ALL"
  }

  tags = local.common_tags
}

###############################################################################
# Sync batches — auditoría temporal de cada batch de sincronización.
# PK: id (uuid generado en cliente = batch_id).
# Permite idempotencia (re-procesar el mismo batch no duplica datos downstream)
# y trazabilidad para debugging/reintentos.
###############################################################################
resource "aws_dynamodb_table" "sync_batches" {
  name         = "${local.name_prefix}-sync_batches"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "received_at"
    type = "S"
  }

  global_secondary_index {
    name            = "tenant_id-received_at-index"
    hash_key        = "tenant_id"
    range_key       = "received_at"
    projection_type = "ALL"
  }

  tags = local.common_tags
}
