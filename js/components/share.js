const el = React.createElement;

const Button = ({ onClick, label }) => el('button', { onClick }, label);

const Text = ({ text }) => el('div', null, text);

const Select = ({ options, onSelect }) => {
  const onChange = (evt) => onSelect(evt.target.value);
  return el('select', { onChange },
    options.map(({ key, value, label }) => el('option', { key, value },
      value === label ? label : `${value} - ${label}`))
  );
};

const styles = {
  button: {
    cursor: 'pointer',
    marginTop: 15,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
    display: 'flex',
    borderRadius: 5,
    width: '100%'
  },
  icon: {
    height: 25,
    width: 25,
    padding: 5
  },
  label: {
    fontWeight: 'bold',
    paddingLeft: 15,
    paddingRight: 15
  }
};

const ShareButton = (props) => {

  const { id, startIcon, label, endIcon, authorize, list, upload } = props;
  const [loading, setLoading] = React.useState(false);
  const [state, setState] = React.useState({
    accessToken: null,
    options: null,
    selected: null,
  });

  const onAuthorize = async() => {
    // optional override of default authorization
    if (authorize) {
      const accessToken = await authorize();
      const options = await list({ accessToken });
      setState({
        accessToken,
        options
      });
      return;
    };
    chrome.runtime.sendMessage({type: id }, async(response) => {
      const accessToken = response?.token;
      const options = await list({ accessToken });
      setState({
        accessToken,
        options
      });
    });
  };

  const onListSelect = async(value) => setState({ ...state, selected: value });

  const onUpload = async() => {
    setLoading(true);
    const res = await upload({
      accessToken: state.accessToken,
      itemID: state.selected,
    });
    console.log("SERVICE METADATA:", res);
    setTimeout(() => setLoading(false), 1000);
  };

  return el('div', null,
    el('button', { onClick: onAuthorize, style: styles.button },
      startIcon ? el('img', { src: startIcon, style: styles.icon }) : null,
      label ? el('span', { style: styles.label}, label) : null,
      endIcon ? el('img', { src: endIcon, style: styles.icon }) : null,
    ),
    state.options ? el(Select, { options: state.options, onSelect: onListSelect }) : null,
    state.selected && !loading ? el('button', { onClick: onUpload }, "Upload") : null,
    loading ? el('div', null, "Loading...") : null
  );
};

//const domContainer = document.querySelector('#service\\:jira');
//ReactDOM.render(el(Share, { accessToken }), domContainer);
