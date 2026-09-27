###############################################################################
# SQS queues — creadas vía script de bootstrap (scripts/bootstrap-sqs.sh).
#
# Motivo: Terraform AWS provider + LocalStack 0.14.5 tienen fricción al
# aplicar resources SQS con redrive_policy (se cuelga >5min en la fase de
# creación). La alternativa soportada en este repo es:
#
#   1. `make bootstrap-sqs`  (corre el script que crea DLQ + main queue)
#   2. `make outputs`        (regenera terraform.auto.tfvars con ARNs/URLs)
#
# Este archivo se conserva como referencia declarativa del target state. Si
# en el futuro se migra a LocalStack 3.x o a AWS real, se puede reactivar
# `terraform apply` sobre SQS eliminando el bloque "lifecycle" del comentario.
###############################################################################

# resource "aws_sqs_queue" "sync_dlq" {
#   name                      = "${local.name_prefix}-sync-dlq"
#   message_retention_seconds = var.dlq_message_retention_seconds
#   tags = local.common_tags
# }
#
# resource "aws_sqs_queue" "sync" {
#   name                       = "${local.name_prefix}-sync"
#   visibility_timeout_seconds = var.sqs_visibility_timeout_seconds
#
#   redrive_policy = jsonencode({
#     deadLetterTargetArn = aws_sqs_queue.sync_dlq.arn
#     maxReceiveCount     = var.sqs_max_receive_count
#   })
#
#   tags = local.common_tags
# }
