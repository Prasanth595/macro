//! Routine templates: a shareable snapshot of a routine with every
//! person-specific value pulled out into named variables. A template never
//! runs. Activating one renders it with the activator's values and creates an
//! ordinary routine they own.

pub mod extract;
pub mod models;
pub mod ports;
pub mod render;
pub mod service;
