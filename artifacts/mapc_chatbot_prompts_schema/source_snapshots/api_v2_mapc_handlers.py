def post_mapc_v3_interpret(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    try:
        response = mapc_pipeline_v3_service.interpret(payload, user_id=user_id)
        response_size = len(json.dumps(response, default=str))
        logger.info(
            "[mapc_v3] interpret response_size=%s has_session=%s",
            response_size,
            isinstance(response, dict) and "session" in response,
        )
        return response
    except MAPCPipelineV3Error as exc:
        raise ValueError(json.dumps(_mapc_v3_detail(exc))) from exc


def post_mapc_v3_ask_options(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    try:
        response = mapc_pipeline_v3_service.ask_options(payload, user_id=user_id)
        response_size = len(json.dumps(response, default=str))
        options_count = len(response.get("options", [])) if isinstance(response, dict) else -1
        logger.info(
            "[mapc_v3] ask-options response_size=%s options_count=%s has_session=%s",
            response_size,
            options_count,
            isinstance(response, dict) and "session" in response,
        )
        return response
    except MAPCPipelineV3Error as exc:
        raise ValueError(json.dumps(_mapc_v3_detail(exc))) from exc


def post_mapc_v3_background(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    try:
        return mapc_pipeline_v3_service.background(payload, user_id=user_id)
    except MAPCPipelineV3Error as exc:
        raise ValueError(json.dumps(_mapc_v3_detail(exc))) from exc


def post_mapc_v3_script(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    try:
        return mapc_pipeline_v3_service.script(payload, user_id=user_id)
    except MAPCPipelineV3Error as exc:
        raise ValueError(json.dumps(_mapc_v3_detail(exc))) from exc


def post_mapc_v3_revise(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    try:
        return mapc_pipeline_v3_service.revise(payload, user_id=user_id)
    except MAPCPipelineV3Error as exc:
        raise ValueError(json.dumps(_mapc_v3_detail(exc))) from exc
