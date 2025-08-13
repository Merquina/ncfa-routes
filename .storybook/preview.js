import '../css/app.css';

export const parameters = {
  docs: {
    inlineStories: true,
  },
  viewport: {
    viewports: {
      mobile: {
        name: 'Mobile',
        styles: {
          width: '375px',
          height: '667px',
        },
      },
      tablet: {
        name: 'Tablet',
        styles: {
          width: '768px',
          height: '1024px',
        },
      },
      desktop: {
        name: 'Desktop',
        styles: {
          width: '1200px',
          height: '800px',
        },
      },
    },
  },
};
