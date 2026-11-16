// Fusul orar al aplicatiei: toate datele si orele se afiseaza in ora Romaniei, indiferent de
// fusul browserului sau al serverului (4.11). Fisier fara 'use client', ca sa poata fi citit si
// din configuratia next-intl de pe server (i18n/request.ts); sla-deadline.ts il re-exporta.
export const APP_TIME_ZONE = 'Europe/Bucharest';
