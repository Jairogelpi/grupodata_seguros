drop function if exists truncate_metrics_database();
drop function if exists truncate_reference_data();
drop function if exists truncate_entes_data();
drop function if exists truncate_policies_data();
drop function if exists set_entes_updated_at();

drop table if exists policies cascade;
drop table if exists advisor_ente_links cascade;
drop table if exists production_years cascade;
drop table if exists production_months cascade;
drop table if exists policy_states cascade;
drop table if exists advisors cascade;

create table if not exists lista_asesores (
    "ASESOR" text not null
);

create table if not exists lista_anos (
    "AÑO_PROD" text not null
);

create table if not exists lista_meses (
    "MES_Prod" text not null
);

create table if not exists lista_estados (
    "ESTADO" text not null
);

create table if not exists entes (
    "Código" text,
    "Nombre" text not null,
    "Tipo" text,
    "Año1" text
);

create table if not exists entes_registrados_asesor (
    "ASESOR" text not null,
    "ENTE" text not null
);

create table if not exists listado_polizas (
    "Código" text,
    "NºPóliza" text,
    "Abrev.Cía" text,
    "Duración" text,
    "Forma Pago" text,
    "Estado" text,
    "Tomador" text,
    "Producto" text,
    "F.Efecto" text,
    "F.Anulación" text,
    "NIF/CIF Tomador" text,
    "Ente Comercial" text,
    "P.Produccion" numeric(14, 2),
    "P.Cartera" numeric(14, 2),
    "Mot.Anulación" text,
    "F. Alta" text,
    "ENTE COMERCIAL2" text,
    "AÑO_PROD" text,
    "MES_Prod" text,
    "Código3" text
);

create index if not exists lista_asesores_asesor_idx on lista_asesores("ASESOR");
create index if not exists lista_anos_ano_prod_idx on lista_anos("AÑO_PROD");
create index if not exists lista_meses_mes_prod_idx on lista_meses("MES_Prod");
create index if not exists lista_estados_estado_idx on lista_estados("ESTADO");
create index if not exists entes_codigo_idx on entes("Código");
create index if not exists entes_registrados_asesor_asesor_idx on entes_registrados_asesor("ASESOR");
create index if not exists entes_registrados_asesor_ente_idx on entes_registrados_asesor("ENTE");
create index if not exists listado_polizas_num_poliza_idx on listado_polizas("NºPóliza");
create index if not exists listado_polizas_ano_mes_idx on listado_polizas("AÑO_PROD", "MES_Prod");
create index if not exists listado_polizas_estado_idx on listado_polizas("Estado");
create index if not exists listado_polizas_codigo3_idx on listado_polizas("Código3");
create index if not exists listado_polizas_tomador_doc_idx on listado_polizas("NIF/CIF Tomador");

create or replace function truncate_policies_data()
returns void
language plpgsql
security definer
as $fn$
begin
    truncate table listado_polizas, lista_anos, lista_meses, lista_estados;
end;
$fn$;

create or replace function truncate_entes_data()
returns void
language plpgsql
security definer
as $fn$
begin
    truncate table entes_registrados_asesor, entes;
end;
$fn$;

create or replace function truncate_reference_data()
returns void
language plpgsql
security definer
as $fn$
begin
    truncate table lista_asesores;
end;
$fn$;

create or replace function truncate_metrics_database()
returns void
language plpgsql
security definer
as $fn$
begin
    truncate table listado_polizas, entes_registrados_asesor, entes, lista_asesores, lista_anos, lista_meses, lista_estados;
end;
$fn$;
