/**
 * Errores del paquete. Todos llevan `code` estable para que el agente de estación
 * los traduzca a `ApiError` sin inspeccionar el mensaje.
 */
export class IntegrationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

/** Transición fuera de la tabla de la máquina de estados. */
export class InvalidTransitionError extends IntegrationError {
  readonly from: string;
  readonly event: string;

  constructor(from: string, event: string, domain = 'payment') {
    super('invalid_transition', `Invalid ${domain} transition: '${from}' + '${event}'`);
    this.from = from;
    this.event = event;
  }
}

/** Adaptador real sin configurar: el mensaje señala el documento con el plan de integración. */
export class NotConfiguredError extends IntegrationError {
  readonly adapter: string;
  readonly docs: string | undefined;

  constructor(adapter: string, message: string, docs?: string) {
    super('not_configured', message);
    this.adapter = adapter;
    this.docs = docs;
  }
}

export class NotFoundError extends IntegrationError {
  readonly kind: string;
  readonly id: string;

  constructor(kind: string, id: string) {
    super('not_found', `${kind} not found: ${id}`);
    this.kind = kind;
    this.id = id;
  }
}

export class ValidationError extends IntegrationError {
  constructor(message: string) {
    super('invalid_input', message);
  }
}
