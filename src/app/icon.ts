import { Component, input } from '@angular/core';
@Component({ selector:'app-icon', standalone:true, template:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="paths[name()] || paths['grid']" /></svg>`, styles:[`:host{display:inline-flex;width:1.25em;height:1.25em;flex-shrink:0}svg{width:100%;height:100%}`] })
export class IconComponent {
  readonly name = input('grid');
  readonly paths: Record<string,string> = {
    notice:'M4 4h16v13H9l-5 4V4z M8 8h8 M8 12h6',
    board:'M8 3h8v4H8z M12 7v5 M4 12h16 M4 12v5 M12 12v5 M20 12v5 M2 17h4v4H2z M10 17h4v4h-4z M18 17h4v4h-4z',
    grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M15 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    calendar:'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M8 14h2 M14 14h2 M8 18h2',
    plus:'M12 5v14 M5 12h14', search:'M21 21l-4.35-4.35 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    arrow:'M5 12h14 M13 6l6 6-6 6', back:'M19 12H5 M11 6l-6 6 6 6',
    download:'M12 3v12 M7 10l5 5 5-5 M5 17v4h14v-4',
    edit:'M12 20H4V12 M14 5l5 5 M20 4a2 2 0 0 0-3 0L8 13l-1 4 4-1 9-9a2 2 0 0 0 0-3',
    switch:'M4 7h16 M16 3l4 4-4 4 M20 17H4 M8 13l-4 4 4 4',
    logout:'M9 4H4v16h5 M9 12h12 M17 8l4 4-4 4',
    heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8',
    check:'M5 12l4 4L19 6', info:'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    church:'M3 21h18 M5 21V10l7-5 7 5v11 M10 21v-7h4v7 M12 1v5 M9 3h6',
  };
}
