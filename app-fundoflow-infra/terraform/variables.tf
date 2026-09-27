variable "project_name" {
  description = "Nombre del proyecto, usado como prefijo para todos los recursos"
  type        = string
  default     = "fundoflow"
}

variable "aws_region" {
  description = "Región AWS simulada por LocalStack"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Entorno de despliegue"
  type        = string
  default     = "local"
}

variable "sqs_visibility_timeout_seconds" {
  description = "Visibility timeout de la cola de sync (segundos)"
  type        = number
  default     = 120
}

variable "sqs_max_receive_count" {
  description = "Cantidad máxima de recepciones antes de enviar a DLQ"
  type        = number
  default     = 3
}

variable "dlq_message_retention_seconds" {
  description = "Retención de mensajes en DLQ (segundos, máx 1209600 = 14 días)"
  type        = number
  default     = 1209600
}

variable "bootstrap" {
  description = "Valores generados por scripts/bootstrap-sqs.sh para outputs"
  type        = any
  default     = {}
}
