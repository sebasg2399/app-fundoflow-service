###############################################################################
# Outputs DynamoDB — nombres y ARNs de las tablas para consumo del backend.
###############################################################################
output "dynamodb_tables" {
  description = "Nombres de las tablas DynamoDB creadas"
  value = {
    tenants      = aws_dynamodb_table.tenants.name
    workers      = aws_dynamodb_table.workers.name
    harvest_logs = aws_dynamodb_table.harvest_logs.name
    sync_batches = aws_dynamodb_table.sync_batches.name
  }
}

output "dynamodb_table_arns" {
  description = "ARNs de las tablas DynamoDB creadas"
  value = {
    tenants      = aws_dynamodb_table.tenants.arn
    workers      = aws_dynamodb_table.workers.arn
    harvest_logs = aws_dynamodb_table.harvest_logs.arn
    sync_batches = aws_dynamodb_table.sync_batches.arn
  }
}

###############################################################################
# Outputs SQS — leídos desde variables (terraform.auto.tfvars) generadas por
# scripts/bootstrap-sqs.sh. Si el archivo no existe, se usan defaults vacíos.
###############################################################################
locals {
  sqs_outputs = try(var.bootstrap.sqs, {})
}

output "sqs_queue_url" {
  description = "URL de la cola principal de sincronización"
  value       = try(local.sqs_outputs.queue_url, "")
}

output "sqs_queue_arn" {
  description = "ARN de la cola principal de sincronización"
  value       = try(local.sqs_outputs.queue_arn, "")
}

output "sqs_dlq_url" {
  description = "URL de la dead-letter queue"
  value       = try(local.sqs_outputs.dlq_url, "")
}

output "sqs_dlq_arn" {
  description = "ARN de la dead-letter queue"
  value       = try(local.sqs_outputs.dlq_arn, "")
}

output "aws_region" {
  description = "Región AWS simulada"
  value       = var.aws_region
}

output "name_prefix" {
  description = "Prefijo usado para nombrar todos los recursos"
  value       = local.name_prefix
}
