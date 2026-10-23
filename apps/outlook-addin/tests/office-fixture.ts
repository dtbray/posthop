import type { Page } from "@playwright/test";

interface Options {
  saveFailure?: boolean;
  attachments?: boolean;
}
export async function mockOutlook(page: Page, options: Options = {}) {
  await page.route("https://appsforoffice.microsoft.com/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `(() => {
      const options=${JSON.stringify(options)};
      const initial={subject:'Outlook compose contract test',html:'<h2>Event instructions</h2><p>Arrive at 6 pm.</p>',text:'Event instructions. Arrive at 6 pm.'};
      const current=()=>JSON.parse(localStorage.getItem('office-test-draft')||JSON.stringify(initial));
      const success=value=>({status:'succeeded',value});
      const props={
        get:()=>localStorage.getItem('office-test-key'),
        set:(_name,key)=>{props.pending=key},
        saveAsync:callback=>{
          if(options.saveFailure){callback({status:'failed',error:{message:'Draft metadata could not be saved'}});return;}
          localStorage.setItem('office-test-key',props.pending);
          localStorage.setItem('office-test-save-count',String(Number(localStorage.getItem('office-test-save-count')||'0')+1));
          callback(success(undefined));
        }
      };
      window.Office={
        HostType:{Outlook:'Outlook'},AsyncResultStatus:{Succeeded:'succeeded',Failed:'failed'},CoercionType:{Html:'html',Text:'text'},
        onReady:()=>Promise.resolve({host:'Outlook'}),
        context:{requirements:{isSetSupported:()=>true},mailbox:{item:{
          subject:{getAsync:callback=>callback(success(current().subject))},
          body:{getAsync:(coercion,callback)=>callback(success(coercion==='html'?current().html:current().text))},
          getAttachmentsAsync:callback=>callback(success(options.attachments?[{name:'file.pdf'}]:[])),
          loadCustomPropertiesAsync:callback=>callback(success(props))
        }}}
      };
    })();`,
    }),
  );
}
