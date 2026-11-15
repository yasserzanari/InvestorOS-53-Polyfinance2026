output "function_name" {
  value = aws_lambda_function.api.function_name
}

output "profiles_route" {
  value = "${data.terraform_remote_state.foundation.outputs.api_url}/v1/profiles/*"
}

output "simulation_route" {
  value = "${data.terraform_remote_state.foundation.outputs.api_url}/v1/simulation/*"
}

output "model_id" {
  value = var.bedrock_model_id
}
