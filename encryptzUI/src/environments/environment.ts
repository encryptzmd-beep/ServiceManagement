// src/environments/environment.ts
export const environment = {
  production: false,

  // apiUrl: 'https://serviceapp.encryptz.in/api'
   //  apiUrl:'https://app.encryptz.in'
    //apiUrl:'http://192.168.1.39:5092'
    //apiUrl:'http://localhost:5092',
  // Production build (Hostinger VPS, erp.encryptz.in): nginx passes /api/... and /hubs/...
  // to the API unchanged, so the UI calls them on the same origin with no extra prefix.
  // (For the old IIS setup, where the API was an IIS application named "api", use '/api'.)
  apiUrl:'',
  //apiUrl:'https://erp.encryptz.in',

  // Customer portal: the project (MainDB Projects.ProjectKey) whose database customers
  // register / log in to. A link with ?project=KEY overrides it for that browser.
  customerProjectKey: 'C001-P001'
};

// src/environments/environment.prod.ts
// export const environment = {
//   production: true,
//   apiUrl: 'https://api.felixfitness.in'
// };
