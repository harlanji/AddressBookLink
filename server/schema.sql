CREATE TABLE public.bloombase
(
    id character varying(255) COLLATE pg_catalog."default" NOT NULL,
    base character varying(255) COLLATE pg_catalog."default" NOT NULL,
    bloom text COLLATE pg_catalog."default",
    CONSTRAINT bloombase_pkey PRIMARY KEY (base, id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.bloombase
    OWNER to bloombase;