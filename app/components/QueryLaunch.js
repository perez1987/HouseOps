// @flow
import React, { Component } from 'react';

import {
  Alignment,
  Button,
  Navbar,
  NavbarGroup,
  NavbarDivider,
  Tooltip,
  Position,
  Dialog,
  Intent,
  Alert,
  InputGroup,
  Callout
} from '@blueprintjs/core';

import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/theme/chaos';
import 'brace/ext/language_tools';
import 'brace/ext/statusbar';
import ace from 'brace';

import ReactResizeDetector from 'react-resize-detector';

import { HotKeys } from 'react-hotkeys';

import 'react-table/react-table.css';

import toaster from '../utils/toaster';
import executeQuery from '../utils/query';
import localStorageVariables from '../utils/localStorageVariables';

const { getGlobal } = require('electron').remote;

const trackEvent = getGlobal('trackEvent');

const langTools = ace.acequire('ace/ext/language_tools');

export default class QueryLaunch extends Component<Props> {
  constructor() {
    super();

    this.state = {
      value: '',
      currentQuery: '',
      editorHeight: '200px',
      shortcutsVisibility: false,
      loading: false,
      confirmDropModalVisible: false,
      queryStatistics: ''
    };
  }

  componentWillMount() {
    this.aceEditor = React.createRef();
    this.autoCompleter();
  }

  hotKeysMap = {
    execute: ['ctrl+enter', 'command+enter']
  };

  hotKeysHandlers = {
    execute: () => this.onQuery()
  };

  onResizeEditor = () => {
    const height = document.getElementById('editor').clientHeight;

    this.setState({
      editorHeight: `${height - 35}px`
    });
  };

  onLoad = () => {
    const value = localStorage.getItem('query') ? localStorage.getItem('query') : '';

    this.setState({
      value
    });

    setTimeout(() => {
      this.onResizeEditor();
    }, 100);
  };

  autoCompleter = () => { //eslint-disable-line
    // TODO: Fix this to execute only when DatabaseTree is updated.
    setTimeout(() => {
      const col = JSON.parse(localStorage.getItem('autoCompleteCollection'));
      const newCol = [];

      col.forEach((value) => {
        let include = true;

        newCol.forEach((_value) => {
          if (value.name === _value.name) {
            include = false;
          }
        });

        if (include) {
          newCol.push(value);
        }
      });

      const customCompleter = {
        getCompletions: (editor, session, pos, prefix, callback) => {
          callback(null, newCol);
        }
      };

      langTools.completer = null;

      langTools.addCompleter(customCompleter);
    }, 5000);
  };

  onChange = (newValue) => {
    localStorage.setItem('query', newValue);

    this.setState({
      value: newValue
    });
  };

  handleConfirmDROP = (e) => this.setState({ confirmDROP: e.target.value });

  confirmModalCancel = () => {
    this.setState({
      confirmDropModalVisible: false,
      confirmDROP: '',
      loading: false
    });
  };

  confirmModalOk = () => {
    if (this.state.confirmDROP === 'DROP') {
      this.setState({
        confirmDropModalVisible: false,
        confirmDROP: ''
      });

      this.onQuery(null, true);
    } else {
      toaster.show({
        message: 'Type DROP to confirm.',
        intent: Intent.WARNING,
        icon: 'error',
        timeout: 5000
      });
    }
  };

  query = async (content) => {
    trackEvent('User Interaction', 'QueryLaunch executed');
    return executeQuery(content);
  };

  getQuery = () => {
    if (this.aceEditor.current.editor.getSelectedText().length > 0) {
      return this.aceEditor.current.editor.getSelectedText();
    }

    return this.state.value;
  };

  onQuery = async (e, dropConfirmation = false) => {
    if (!this.state.loading) {
      try {
        const query = this.getQuery();

        this.setState({ currentQuery: query });

        if (
          (!localStorage.getItem(localStorageVariables.Disable_Drop_Alert_Confirm) || localStorage.getItem(localStorageVariables.Disable_Drop_Alert_Confirm) === 'false') &&
          !dropConfirmation &&
          query.toLowerCase().indexOf('drop') > -1
        ) {
          this.setState({
            confirmDropModalVisible: true
          });

          return;
        }

        this.setState({
          loading: true
        });

        const response = await this.query(query);

        if (response.data) {
          this.props.onData(response.data);
        } else {
          this.props.onData({});
        }

        this.setState({
          loading: false
        });

        if (response.data) {
          this.setState({
            queryStatistics: `returned ${response.data.rows} rows, elapsed ${response.data.statistics.elapsed.toFixed(3)}ms, ${response.data.statistics.rows_read} rows processed on ${parseFloat(response.data.statistics.bytes_read / 1000).toFixed(2)}KB of data`
          });
        } else {
          this.setState({
            queryStatistics: ''
          });
          toaster.show({
            message: 'Your query running ok.',
            intent: Intent.SUCCESS,
            icon: 'tick-circle',
            timeout: 5000
          });
        }
      } catch (err) {
        console.error(err);

        this.props.onData({});

        toaster.show({
          message: err.response && err.response.data ? `${err.message} - ${err.response.data}` : `${err.message}`,
          intent: Intent.DANGER,
          icon: 'error',
          timeout: 0
        });

        this.setState({
          loading: false,
          queryStatistics: ''
        });
      }
    }
  };

  shortcutsHandleClose = () => {
    this.setState({ shortcutsVisibility: false });
  };

  shortcutsHandleOpen = () => {
    this.setState({ shortcutsVisibility: true });
  };

  render() {
    return (
      <div id="editor" style={{ height: '100%' }}>

        <Alert
          isOpen={this.state.confirmDropModalVisible}
          intent={Intent.DANGER}
          icon="trash"
          cancelButtonText="NO, you save me."
          confirmButtonText="YES, I want!"
          onConfirm={this.confirmModalOk}
          onCancel={this.confirmModalCancel}
        >
          <div>
            <s><b>Oh my god</b></s>, you <b>really want</b> to execute <b>DROP</b> command?
            <br /><br />

            <Callout>
              <small>{this.state.currentQuery}</small>
            </Callout>

            <br />
            <small>Type <b>DROP</b> to confirm:</small>
            <InputGroup
              type="text"
              className="pt-input-group"
              value={this.state.confirmDROP}
              onChange={this.handleConfirmDROP}
            />
            <br />

            <small>You can disable this alert in settings.</small>
            <br /><br />
          </div>
        </Alert>

        <Navbar
          style={{
            height: '35px', marginTop: '0px', marginLeft: '0px', zIndex: '0', backgroundColor: '#293742'
          }}
        >

          <NavbarGroup align={Alignment.LEFT} style={{ height: '35px' }}>

            <Tooltip content="Launch query" position={Position.BOTTOM}>
              <Button
                loading={this.state.loading}
                onClick={this.onQuery}
                className="pt-small pt-minimal"
                icon="play"
                text=""
              />
            </Tooltip>

          </NavbarGroup>

          <NavbarGroup align={Alignment.RIGHT} style={{ height: '35px' }}>

            <small style={{ color: '#bfccd6' }}>{this.state.queryStatistics}</small>

            <NavbarDivider />

            <Tooltip content="Keyboard Shortcuts and Help" position={Position.LEFT}>
              <Button
                onClick={this.shortcutsHandleOpen}
                className="pt-small pt-minimal"
                icon="comment"
                text=""
              />
            </Tooltip>

          </NavbarGroup>

        </Navbar>

        <HotKeys keyMap={this.hotKeysMap} handlers={this.hotKeysHandlers}>

          <AceEditor
            style={{
              margin: '0', width: '100%'
            }}
            mode="sql"
            height={this.state.editorHeight}
            theme="chaos"
            onChange={this.onChange}
            onLoad={this.onLoad}
            value={this.state.value}
            defaultValue={this.state.value}
            name="aceEditor"
            editorProps={{ $blockScrolling: true }}
            ref={this.aceEditor}
            setOptions={{
              enableLiveAutocompletion: true,
              showLineNumbers: true,
              tabSize: 2,
              liveAutocompletionThreshold: 1,
              fontSize: '14px'
            }}
          />

        </HotKeys>

        <ReactResizeDetector
          handleHeight
          onResize={this.onResizeEditor}
        />

        <Dialog
          icon="comment"
          isOpen={this.state.shortcutsVisibility}
          onClose={this.shortcutsHandleClose}
          title="Keyboard Shortcuts and Help"
        >
          <div className="pt-dialog-body">

            <h4>Help</h4>
            Select text to run query localized or all text in editor is executed.

            <br /><br /><br />

            <h4>Keyboard Shortcuts</h4>
            <b>CTRL or COMMAND + ENTER</b> -- Launch query

          </div>
        </Dialog>
      </div>
    );
  }
}
