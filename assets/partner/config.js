/*
  Title: Partner Program Settings
  Author: Hali Sarah Parsons
  Date: 2026-10-31
  Modified By: Claude
  Description: One place for the Google Apps Script web-app URL that stores new partners
               (from /NewPartners/) in the Google Sheet. Every partner page reads it from here.
*/
// WHY one shared file: paste the /exec URL once and every page (Referrals, Partners,
// NewPartners, referral tracking) starts recognizing new partners. Empty = feature off.
window.MK_PARTNER_API = 'https://script.google.com/macros/s/AKfycbwx7n4JeY5KHc_p8dEdhDK18EIU1IhLfmLULmc31u_fLMN1-kDPQVunY7dZ0Ss8hFwT/exec';

/** Loads new partners from the Sheet as [[business, city, code], ...].
    WHY cached promise: several pieces of a page may ask at once; only one request goes out. */
window.loadNewPartners = function(){
  if(window._newPartnersP) return window._newPartnersP;
  if(!window.MK_PARTNER_API){ window._newPartnersP = Promise.resolve([]); return window._newPartnersP; }
  window._newPartnersP = fetch(window.MK_PARTNER_API + '?action=list')
    .then(function(r){ return r.json(); })
    .then(function(d){ return Array.isArray(d) ? d : []; })
    // WHY: if the Sheet is unreachable, the mailing-list businesses still work
    .catch(function(){ return []; });
  return window._newPartnersP;
};
